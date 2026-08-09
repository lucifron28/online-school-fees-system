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
});
