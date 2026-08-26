import dotenv from 'dotenv';
import path from 'path';
import { createDb, DatabaseInstance } from '../index';
import * as schema from '../schema';
import { logSanitizedError } from '../../server/logging';
import { seedDemoData } from './seed';
import {
  assertSafeDatabaseReset,
  DEMO_RESET_CONFIRMATION,
  ResetMode,
  TEST_RESET_CONFIRMATION,
} from './reset-safety';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface ResetOptions {
  mode?: ResetMode;
  env?: NodeJS.ProcessEnv;
  database?: DatabaseInstance;
}

function resolveMode(mode?: ResetMode): ResetMode {
  if (mode) return mode;
  return process.argv.includes('--test') ? 'test' : 'demo';
}

export function resolveResetTarget(mode: ResetMode, env: NodeJS.ProcessEnv): string {
  return assertSafeDatabaseReset({
    mode,
    databaseUrl: mode === 'test' ? env.TEST_DATABASE_URL : env.DATABASE_URL,
    applicationDatabaseUrl: env.DATABASE_URL,
    testDatabaseUrl: env.TEST_DATABASE_URL,
    confirmation: mode === 'test' ? env.TEST_DB_RESET_CONFIRMATION : env.DEMO_DB_RESET_CONFIRMATION,
    nodeEnv: env.NODE_ENV,
  });
}

export async function clearDemoData(database: DatabaseInstance, includeAuthTables: boolean) {
  await database.delete(schema.mockPaymentCallbackEvents);
  await database.delete(schema.mockPaymentCheckouts);
  await database.delete(schema.notificationDeliveryAttempts);
  await database.delete(schema.notificationDeliveries);
  await database.delete(schema.notifications);
  await database.delete(schema.announcements);
  await database.delete(schema.paymentSubmissionProofs);
  await database.delete(schema.paymentSubmissions);
  await database.delete(schema.auditLogs);
  await database.delete(schema.paymentReversals);
  await database.delete(schema.receipts);
  await database.delete(schema.receiptNumberSequences);
  await database.delete(schema.paymentAllocations);
  await database.delete(schema.payments);
  await database.delete(schema.ledgerEntries);
  await database.delete(schema.adjustments);
  await database.delete(schema.assessmentItems);
  await database.delete(schema.studentAssessments);
  await database.delete(schema.guardianStudents);
  await database.delete(schema.guardians);
  await database.delete(schema.students);
  await database.delete(schema.feeStructureItems);
  await database.delete(schema.feeStructures);
  await database.delete(schema.feeCategories);

  if (includeAuthTables) {
    await database.delete(schema.schoolSettings);
    await database.delete(schema.sections);
    await database.delete(schema.gradeLevels);
    await database.delete(schema.schoolYears);
    await database.delete(schema.verifications);
    await database.delete(schema.sessions);
    await database.delete(schema.accounts);
    await database.delete(schema.users);
  }
}

export async function resetDemoDatabase(options: ResetOptions = {}) {
  const mode = resolveMode(options.mode);
  const env = options.env ?? process.env;
  const databaseUrl = resolveResetTarget(mode, env);
  const database = options.database ?? createDb(databaseUrl);

  console.log(`Resetting ${mode} database state...`);
  await clearDemoData(database, mode === 'test');
  await seedDemoData(database);
  console.log(`${mode === 'test' ? 'Test' : 'Demo'} database reset completed.`);
}

if (process.argv[1]?.includes('reset-demo.ts')) {
  resetDemoDatabase()
    .then(() => process.exit(0))
    .catch((error: unknown) => {
      logSanitizedError('demo.reset', error);
      console.error(
        `Use ${DEMO_RESET_CONFIRMATION} for demo resets or ${TEST_RESET_CONFIRMATION} for test resets, and never point both database URLs at the same database.`
      );
      process.exit(1);
    });
}
