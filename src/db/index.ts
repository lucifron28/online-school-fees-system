import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { Pool } from 'pg';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index';

export type DatabaseInstance = NeonHttpDatabase<typeof schema>;

let _dbInstance: DatabaseInstance | null = null;
const localPoolInstances = new Map<string, Pool>();

function shouldUseLocalPostgres(databaseUrl: string): boolean {
  if (process.env.DATABASE_DRIVER === 'pg') return true;

  try {
    const hostname = new URL(databaseUrl).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

export function createDb(databaseUrl: string): DatabaseInstance {
  if (!databaseUrl) {
    throw new Error('A database URL is required to create a database client.');
  }

  if (shouldUseLocalPostgres(databaseUrl)) {
    const pool = localPoolInstances.get(databaseUrl) ?? new Pool({ connectionString: databaseUrl });
    localPoolInstances.set(databaseUrl, pool);
    // The Drizzle APIs used by the application are shared by both PostgreSQL drivers.
    return drizzleNodePg(pool, { schema }) as unknown as DatabaseInstance;
  }

  const sql: NeonQueryFunction<boolean, boolean> = neon(databaseUrl);
  return drizzle(sql, { schema });
}

/**
 * Server-only database accessor.
 * Returns the Drizzle ORM database client initialized with Neon PostgreSQL.
 * Allows build-time initialization without requiring an active database connection.
 * Throws a clear configuration error if DATABASE_URL is not set when a database operation is actually invoked at runtime.
 */
export function getDb(databaseUrlOverride?: string): DatabaseInstance {
  if (databaseUrlOverride) return createDb(databaseUrlOverride);
  if (_dbInstance) return _dbInstance;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    const placeholderUrl =
      'postgresql://build_placeholder:build_placeholder@localhost:5432/build_placeholder';
    const sql = neon(placeholderUrl);
    _dbInstance = drizzle(sql, { schema });
    return _dbInstance;
  }

  _dbInstance = createDb(databaseUrl);
  return _dbInstance;
}

/**
 * Proxy for `db`.
 * Accessing any query method at runtime requires DATABASE_URL to be defined.
 */
export const db = new Proxy({} as DatabaseInstance, {
  get(_target, prop, receiver) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL environment variable is missing. Database access requires a valid Neon PostgreSQL connection string. Please configure DATABASE_URL in your environment or .env.local file.'
      );
    }
    const client = getDb();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
