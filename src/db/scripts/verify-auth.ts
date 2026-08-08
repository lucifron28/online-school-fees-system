import dotenv from 'dotenv';
import path from 'path';
import { eq } from 'drizzle-orm';
import { getDb } from '../index';
import * as schema from '../schema';
import { createAuth } from '../../lib/auth/server';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DEMO_PASSWORD = 'DemoPass123!';

async function signIn(auth: ReturnType<typeof createAuth>, email: string, password: string) {
  try {
    const response = await auth.handler(
      new Request('http://localhost:3000/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe: true }),
      })
    );
    const result = (await response.json()) as {
      token?: string;
      user?: { email?: string; role?: string };
      message?: string;
      error?: string;
    };
    const responseHeaders = response.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies = responseHeaders.getSetCookie?.() ?? [
      response.headers.get('set-cookie') ?? '',
    ];
    const sessionCookie = setCookies.find(
      (cookie) =>
        cookie.startsWith('better-auth.session_token=') ||
        cookie.startsWith('__Secure-better-auth.session_token=')
    );

    if (!response.ok || !result.token || !sessionCookie) {
      return {
        ok: false as const,
        message: result.message || result.error || `Sign-in failed with HTTP ${response.status}`,
      };
    }

    return {
      ok: true as const,
      result,
      cookie: sessionCookie.split(';', 1)[0],
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function sessionHeaders(cookie: string): Headers {
  return new Headers({ cookie });
}

async function main() {
  const db = getDb();
  const auth = createAuth({ database: db });
  const checks: string[] = [];

  for (const email of [
    'admin@demo.school',
    'finance@demo.school',
    'parent@demo.school',
    'student@demo.school',
  ]) {
    const result = await signIn(auth, email, DEMO_PASSWORD);
    if (!result.ok) throw new Error(`Demo sign-in failed for ${email}: ${result.message}`);
    checks.push(email);
  }

  const adminSignIn = await signIn(auth, 'admin@demo.school', DEMO_PASSWORD);
  if (!adminSignIn.ok) throw new Error(adminSignIn.message);

  const session = await auth.api.getSession({
    headers: sessionHeaders(adminSignIn.cookie),
  });
  if (!session || session.user.email !== 'admin@demo.school' || session.user.role !== 'ADMIN') {
    throw new Error('Authenticated session did not preserve the stored admin role.');
  }

  const signedOut = await auth.api.signOut({ headers: sessionHeaders(adminSignIn.cookie) });
  if (!signedOut.success) throw new Error('Better Auth sign-out did not report success.');
  const afterSignOut = await auth.api.getSession({
    headers: sessionHeaders(adminSignIn.cookie),
  });
  if (afterSignOut) throw new Error('Session remained valid after sign-out.');

  const invalidPassword = await signIn(auth, 'admin@demo.school', 'wrong-password');
  if (invalidPassword.ok) throw new Error('Invalid credentials were accepted.');

  const [student] = await db
    .select({ id: schema.users.id, active: schema.users.active })
    .from(schema.users)
    .where(eq(schema.users.email, 'student@demo.school'))
    .limit(1);
  if (!student) throw new Error('Student demo user was not found.');

  await db.update(schema.users).set({ active: false }).where(eq(schema.users.id, student.id));
  try {
    const disabled = await signIn(auth, 'student@demo.school', DEMO_PASSWORD);
    if (disabled.ok) throw new Error('Disabled user was accepted.');
  } finally {
    await db.update(schema.users).set({ active: true }).where(eq(schema.users.id, student.id));
  }

  try {
    await auth.api.signUpEmail({
      body: {
        name: 'Public Signup Attempt',
        email: `signup-${Date.now()}@demo.school`,
        password: DEMO_PASSWORD,
      },
    });
    throw new Error('Public sign-up was accepted.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes('sign up') && !message.toLowerCase().includes('disabled')) {
      throw error;
    }
  }

  console.log(
    `Auth contract verified: ${checks.length} demo accounts, invalid credentials, disabled users, session persistence, logout, and public sign-up rejection.`
  );
}

main().catch((error) => {
  console.error('Auth verification failed:', error);
  process.exitCode = 1;
});
