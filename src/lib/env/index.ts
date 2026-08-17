import { z } from 'zod/v3';

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().optional().or(z.literal('')),
  BETTER_AUTH_SECRET: z.string().min(1).optional().or(z.literal('')),
  BETTER_AUTH_API_KEY: z.string().min(1).optional().or(z.literal('')),
  BETTER_AUTH_URL: z.string().url().optional().or(z.literal('')),
  RESEND_API_KEY: z.string().min(1).optional().or(z.literal('')),
  EMAIL_FROM: z.string().email().optional().or(z.literal('')),
  CRON_SECRET: z.string().min(1).optional().or(z.literal('')),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ENABLE_MOCK_PAYMENT_HARNESS: z
    .string()
    .optional()
    .transform((value) => value === 'true')
    .default('false'),
  ENABLE_STUDENT_PORTAL: z
    .string()
    .optional()
    .transform((v) => v !== 'false')
    .default('true'),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional().default('http://localhost:3000'),
  NEXT_PUBLIC_ENABLE_DEMO_NAV: z
    .string()
    .optional()
    .transform((v) => v !== 'false')
    .default('true'),
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_API_KEY: process.env.BETTER_AUTH_API_KEY,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    CRON_SECRET: process.env.CRON_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    ENABLE_MOCK_PAYMENT_HARNESS: process.env.ENABLE_MOCK_PAYMENT_HARNESS,
    ENABLE_STUDENT_PORTAL: process.env.ENABLE_STUDENT_PORTAL,
  });
}

export function getClientEnv() {
  return clientEnvSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_ENABLE_DEMO_NAV: process.env.NEXT_PUBLIC_ENABLE_DEMO_NAV,
  });
}
