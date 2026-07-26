import { z } from 'zod';

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().optional().or(z.literal('')),
  BETTER_AUTH_SECRET: z.string().min(1).optional().or(z.literal('')),
  BETTER_AUTH_URL: z.string().url().optional().or(z.literal('')),
  RESEND_API_KEY: z.string().min(1).optional().or(z.literal('')),
  EMAIL_FROM: z.string().email().optional().or(z.literal('')),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional().default('http://localhost:3000'),
});

export function getServerEnv() {
  return serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    NODE_ENV: process.env.NODE_ENV,
  });
}

export function getClientEnv() {
  return clientEnvSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
}
