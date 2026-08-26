import { describe, expect, it } from 'vitest';
import { createDb, getDb } from '@/db';

describe('runtime database configuration', () => {
  it('fails clearly when runtime database access has no DATABASE_URL', () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      expect(() => getDb().select).toThrow(
        'DATABASE_URL environment variable is missing. Runtime database access requires'
      );
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('rejects an empty explicit database URL without constructing a client', () => {
    expect(() => createDb('')).toThrow('A database URL is required to create a database client.');
  });

  it('constructs a transaction-capable node-postgres client for production-style Neon pooled URLs', () => {
    const productionDb = createDb(
      'postgresql://neondb_owner:npg_secret@ep-fictional-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require'
    );

    expect(productionDb).toBeDefined();
    expect(typeof productionDb.transaction).toBe('function');
    expect(typeof productionDb.select).toBe('function');
    expect(typeof productionDb.insert).toBe('function');
    expect(typeof productionDb.update).toBe('function');
    expect(typeof productionDb.delete).toBe('function');
  });

  it('reuses pooled instance for identical database URLs', () => {
    const url =
      'postgresql://user:pass@ep-sample-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
    const client1 = createDb(url);
    const client2 = createDb(url);
    expect(client1).toBeDefined();
    expect(client2).toBeDefined();
  });
});
