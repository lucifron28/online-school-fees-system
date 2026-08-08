import {
  assertSafeDatabaseReset,
  DEMO_RESET_CONFIRMATION,
  TEST_RESET_CONFIRMATION,
} from '@/db/scripts/reset-safety';
import { describe, expect, it } from 'vitest';

const applicationDatabaseUrl = 'postgresql://demo:demo@localhost:5432/osfs_demo?sslmode=require';
const testDatabaseUrl = 'postgresql://demo:demo@localhost:5432/osfs_test?sslmode=require';

describe('database reset safeguards', () => {
  it('allows an explicitly confirmed demo reset on a non-production database', () => {
    expect(
      assertSafeDatabaseReset({
        mode: 'demo',
        databaseUrl: applicationDatabaseUrl,
        testDatabaseUrl,
        confirmation: DEMO_RESET_CONFIRMATION,
        nodeEnv: 'development',
      })
    ).toBe(applicationDatabaseUrl);
  });

  it('requires a separate test database and explicit test confirmation', () => {
    expect(() =>
      assertSafeDatabaseReset({
        mode: 'test',
        databaseUrl: applicationDatabaseUrl,
        applicationDatabaseUrl,
        testDatabaseUrl,
        confirmation: TEST_RESET_CONFIRMATION,
        nodeEnv: 'test',
      })
    ).toThrow('TEST_DATABASE_URL');

    expect(
      assertSafeDatabaseReset({
        mode: 'test',
        databaseUrl: testDatabaseUrl,
        applicationDatabaseUrl,
        testDatabaseUrl,
        confirmation: TEST_RESET_CONFIRMATION,
        nodeEnv: 'test',
      })
    ).toBe(testDatabaseUrl);
  });

  it('rejects production and unconfirmed destructive resets', () => {
    expect(() =>
      assertSafeDatabaseReset({
        mode: 'demo',
        databaseUrl: applicationDatabaseUrl,
        confirmation: DEMO_RESET_CONFIRMATION,
        nodeEnv: 'production',
      })
    ).toThrow('NODE_ENV=production');

    expect(() =>
      assertSafeDatabaseReset({
        mode: 'demo',
        databaseUrl: applicationDatabaseUrl,
        confirmation: 'nope',
        nodeEnv: 'development',
      })
    ).toThrow(DEMO_RESET_CONFIRMATION);
  });
});
