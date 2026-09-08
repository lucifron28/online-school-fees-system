import { spawnSync } from 'node:child_process';
import { rm, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const recordingDatabaseUrl = process.env.DEMO_RECORDING_DATABASE_URL;
const applicationDatabaseUrl = process.env.DATABASE_URL;
if (!recordingDatabaseUrl) {
  throw new Error(
    'Set DEMO_RECORDING_DATABASE_URL to a dedicated non-production Neon branch before recording.'
  );
}
if (recordingDatabaseUrl === applicationDatabaseUrl) {
  throw new Error('DEMO_RECORDING_DATABASE_URL must not equal DATABASE_URL.');
}
if (process.env.NODE_ENV === 'production') {
  throw new Error('Demo recordings cannot run with NODE_ENV=production.');
}

const outputDirectory = path.resolve('artifacts/core-workflow-videos');
await rm(outputDirectory, { recursive: true, force: true });

const packageManager = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const baseEnvironment: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL: recordingDatabaseUrl,
  DEMO_DB_RESET_CONFIRMATION: 'RESET_DEMO',
  ENABLE_MOCK_PAYMENT_HARNESS: 'false',
  BETTER_AUTH_SECRET:
    process.env.BETTER_AUTH_SECRET ?? 'codex-recording-only-better-auth-secret-20260908',
};
const resetEnvironment: NodeJS.ProcessEnv = { ...baseEnvironment, NODE_ENV: 'development' };
const productionEnvironment: NodeJS.ProcessEnv = { ...baseEnvironment, NODE_ENV: 'production' };

function run(label: string, args: string[], env: NodeJS.ProcessEnv) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(packageManager, args, {
    env,
    shell: process.platform === 'win32',
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}.`);
}

run('Reset isolated demo database', ['db:reset'], resetEnvironment);
run('Build production bundle', ['build'], productionEnvironment);
run(
  'Record core workflows',
  ['exec', 'playwright', 'test', '--config=playwright.recording.config.ts'],
  productionEnvironment
);

const expectedFiles = [
  '01-gcash-payment-approval.webm',
  '02-maya-payment-rejection.webm',
  '03-otc-cash-payment.webm',
];
const files = await readdir(outputDirectory);
if (files.length !== expectedFiles.length || expectedFiles.some((file) => !files.includes(file))) {
  throw new Error(`Expected exactly the three core workflow videos in ${outputDirectory}.`);
}

for (const filename of expectedFiles) {
  const file = await stat(path.join(outputDirectory, filename));
  if (file.size <= 0) throw new Error(`${filename} is empty.`);
  console.log(`[recording] retained ${filename} · ${file.size} bytes`);
}
