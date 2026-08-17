import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { dash } from '@better-auth/infra';
import { getDb, type DatabaseInstance } from '@/db';
import * as schema from '@/db/schema';
import { getServerEnv } from '@/lib/env';

export interface AuthFactoryOptions {
  allowSignUp?: boolean;
  database?: DatabaseInstance;
}

function vercelDeploymentUrl(value: string | undefined) {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function resolveAuthBaseUrl(
  options: {
    betterAuthUrl?: string;
    nextPublicAppUrl?: string;
    vercelEnv?: string;
    vercelUrl?: string;
  } = {}
) {
  const betterAuthUrl = options.betterAuthUrl ?? process.env.BETTER_AUTH_URL ?? '';
  const nextPublicAppUrl = options.nextPublicAppUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? '';
  const vercelEnv = options.vercelEnv ?? process.env.VERCEL_ENV;
  const deploymentUrl = vercelDeploymentUrl(options.vercelUrl ?? process.env.VERCEL_URL);

  if (betterAuthUrl) return betterAuthUrl;
  if (vercelEnv === 'preview' && deploymentUrl) return deploymentUrl;
  return nextPublicAppUrl || deploymentUrl || 'http://localhost:3000';
}

export function createAuth({ allowSignUp = false, database }: AuthFactoryOptions = {}) {
  const env = getServerEnv();
  const baseURL = resolveAuthBaseUrl({
    betterAuthUrl: env.BETTER_AUTH_URL,
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
  });
  const baseOrigin = new URL(baseURL).origin;
  const trustedOrigins = Array.from(
    new Set([
      baseOrigin,
      ...(env.NODE_ENV === 'production'
        ? []
        : ['http://localhost:*', 'http://127.0.0.1:*', 'http://[::1]:*']),
    ])
  );
  const buildSecret =
    process.env.NEXT_PHASE === 'phase-production-build'
      ? 'osfs-build-placeholder-secret-only-for-static-build-2026'
      : undefined;
  const secret =
    env.BETTER_AUTH_SECRET ||
    buildSecret ||
    (env.NODE_ENV === 'production' ? undefined : 'osfs-development-secret-not-for-production-2026');
  const plugins = env.BETTER_AUTH_API_KEY ? [dash({ apiKey: env.BETTER_AUTH_API_KEY })] : [];

  return betterAuth({
    appName: 'Online School Fees System',
    baseURL,
    trustedOrigins,
    secret,
    plugins,
    database: drizzleAdapter(database ?? getDb(), {
      provider: 'pg',
      schema: {
        user: schema.users,
        account: schema.accounts,
        session: schema.sessions,
        verification: schema.verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      disableSignUp: !allowSignUp,
      requireEmailVerification: false,
    },
    rateLimit: {
      // Keep the normal production safeguard while allowing a school operator's
      // four seeded demo accounts to be verified from one workstation.
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
      },
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          required: false,
          defaultValue: 'STUDENT',
          input: false,
          returned: true,
        },
        active: {
          type: 'boolean',
          required: false,
          defaultValue: true,
          input: false,
          returned: true,
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/sign-in/email') return;

        const email = typeof ctx.body?.email === 'string' ? ctx.body.email.toLowerCase() : null;
        if (!email) return;

        const existing = await ctx.context.internalAdapter.findUserByEmail(email);
        const active = (existing?.user as Record<string, unknown> | undefined)?.active;
        if (existing?.user && active !== true) {
          throw APIError.from('FORBIDDEN', {
            code: 'USER_DISABLED',
            message: 'User account is disabled',
          });
        }
      }),
    },
  });
}

export const auth = createAuth();

export type Session = typeof auth.$Infer.Session;
