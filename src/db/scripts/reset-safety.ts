export type ResetMode = 'demo' | 'test';

export const DEMO_RESET_CONFIRMATION = 'RESET_DEMO';
export const TEST_RESET_CONFIRMATION = 'RESET_TEST_DATABASE';

export interface ResetSafetyInput {
  mode: ResetMode;
  databaseUrl?: string;
  applicationDatabaseUrl?: string;
  testDatabaseUrl?: string;
  confirmation?: string;
  nodeEnv?: string;
}

function normalizeDatabaseUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    url.searchParams.sort();
    return url.toString().replace(/\/$/, '');
  } catch {
    throw new Error('Database reset target must be a valid PostgreSQL connection URL.');
  }
}

function sameDatabaseUrl(left: string, right: string): boolean {
  return normalizeDatabaseUrl(left) === normalizeDatabaseUrl(right);
}

/**
 * Refuses destructive resets unless the target and explicit confirmation match
 * the requested reset mode. This is intentionally pure so it can be tested
 * without connecting to a database.
 */
export function assertSafeDatabaseReset(input: ResetSafetyInput): string {
  if (!input.databaseUrl) {
    throw new Error(
      input.mode === 'test'
        ? 'TEST_DATABASE_URL is required for a test database reset.'
        : 'DATABASE_URL is required for a demo database reset.'
    );
  }

  const targetUrl = normalizeDatabaseUrl(input.databaseUrl);

  if (input.mode === 'test') {
    if (!input.testDatabaseUrl) {
      throw new Error('TEST_DATABASE_URL is required for a test database reset.');
    }

    if (!sameDatabaseUrl(targetUrl, input.testDatabaseUrl)) {
      throw new Error('Test reset target must exactly match TEST_DATABASE_URL.');
    }

    if (input.applicationDatabaseUrl && sameDatabaseUrl(targetUrl, input.applicationDatabaseUrl)) {
      throw new Error('Test reset refused because TEST_DATABASE_URL matches DATABASE_URL.');
    }

    if (input.confirmation !== TEST_RESET_CONFIRMATION) {
      throw new Error(
        `Test reset requires ${TEST_RESET_CONFIRMATION} in TEST_DB_RESET_CONFIRMATION.`
      );
    }

    return targetUrl;
  }

  if (input.nodeEnv === 'production') {
    throw new Error('Demo database reset is disabled when NODE_ENV=production.');
  }

  if (input.testDatabaseUrl && sameDatabaseUrl(targetUrl, input.testDatabaseUrl)) {
    throw new Error('Demo reset refused because DATABASE_URL matches TEST_DATABASE_URL.');
  }

  if (input.confirmation !== DEMO_RESET_CONFIRMATION) {
    throw new Error(
      `Demo reset requires ${DEMO_RESET_CONFIRMATION} in DEMO_DB_RESET_CONFIRMATION.`
    );
  }

  return targetUrl;
}
