import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { getServerEnv } from '@/lib/env';
import { getRoleLoginPath, parseUserRole, type UserRole } from '@/lib/auth/roles';
import { NextResponse } from 'next/server';

export type { UserRole } from '@/lib/auth/roles';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export async function getCurrentUser(
  requestHeaders?: HeadersInit
): Promise<AuthenticatedUser | null> {
  try {
    const reqHeaders = requestHeaders ? new Headers(requestHeaders) : await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session || !session.user) {
      return null;
    }

    const user = session.user as Record<string, unknown>;
    const active = user.active === true;
    if (!active) {
      return null;
    }

    const role = parseUserRole(user.role);
    if (!role) return null;

    return {
      id: String(user.id),
      name: String(user.name || ''),
      email: String(user.email || ''),
      role,
      active,
    };
  } catch (error) {
    return null;
  }
}

export async function requireAuth(
  allowedRoles?: UserRole[],
  requestHeaders?: HeadersInit
): Promise<AuthenticatedUser> {
  const user = await getCurrentUser(requestHeaders);
  if (!user) {
    throw new Error('UNAUTHENTICATED');
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(user.role)) {
      throw new Error('FORBIDDEN');
    }
  }

  if (user.role === 'STUDENT') {
    const env = getServerEnv();
    if (env.ENABLE_STUDENT_PORTAL === false) {
      throw new Error('STUDENT_PORTAL_DISABLED');
    }
  }

  return user;
}

export async function requireAdmin(): Promise<AuthenticatedUser> {
  return requireAuth(['ADMIN']);
}

export async function requireFinanceStaff(): Promise<AuthenticatedUser> {
  return requireAuth(['ADMIN', 'FINANCE_STAFF']);
}

export async function requireParent(): Promise<AuthenticatedUser> {
  return requireAuth(['PARENT']);
}

export async function requireStudent(): Promise<AuthenticatedUser> {
  return requireAuth(['STUDENT']);
}

export async function requirePortalUser(
  allowedRoles: UserRole[],
  loginPath: string
): Promise<AuthenticatedUser> {
  try {
    return await requireAuth(allowedRoles);
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      redirect(loginPath);
    }
    redirect('/unauthorized');
  }
}

export async function requireRequestAuth(
  request: Request,
  allowedRoles?: UserRole[]
): Promise<AuthenticatedUser> {
  return requireAuth(allowedRoles, request.headers);
}

export function authErrorResponse(error: unknown): NextResponse {
  const code = error instanceof Error ? error.message : 'UNAUTHENTICATED';
  const status = code === 'UNAUTHENTICATED' ? 401 : 403;
  return NextResponse.json(
    {
      error: code === 'UNAUTHENTICATED' ? 'Authentication required' : 'Forbidden',
      code,
    },
    { status }
  );
}

export function getLoginPathForUser(user: AuthenticatedUser): string {
  return getRoleLoginPath(user.role);
}
