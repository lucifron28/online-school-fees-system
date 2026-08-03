import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { getServerEnv } from '@/lib/env';

export type UserRole = 'ADMIN' | 'FINANCE_STAFF' | 'PARENT' | 'STUDENT';

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session || !session.user) {
      return null;
    }

    const user = session.user as Record<string, unknown>;
    const active = user.active !== false;
    if (!active) {
      return null;
    }

    return {
      id: String(user.id),
      name: String(user.name || ''),
      email: String(user.email || ''),
      role: (user.role as UserRole) || 'STUDENT',
      active,
    };
  } catch (error) {
    return null;
  }
}

export async function requireAuth(allowedRoles?: UserRole[]): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
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
  return requireAuth(['PARENT', 'ADMIN']);
}

export async function requireStudent(): Promise<AuthenticatedUser> {
  return requireAuth(['STUDENT', 'ADMIN']);
}
