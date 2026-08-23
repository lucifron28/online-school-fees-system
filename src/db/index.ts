import { Pool, type PoolConfig } from 'pg';
import { drizzle, type NodePgDatabase, type NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import { type PgTransaction } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import * as schema from './schema/index';

export type DatabaseSchema = typeof schema;
export type DatabaseInstance = NodePgDatabase<DatabaseSchema>;
export type TransactionInstance = PgTransaction<
  NodePgQueryResultHKT,
  DatabaseSchema,
  ExtractTablesWithRelations<DatabaseSchema>
>;
export type DatabaseClient = DatabaseInstance | TransactionInstance;

let _dbInstance: DatabaseInstance | null = null;
let _missingDbInstance: DatabaseInstance | null = null;
const poolInstances = new Map<string, Pool>();

export const DATABASE_CONFIGURATION_ERROR =
  'DATABASE_URL environment variable is missing. Runtime database access requires a valid PostgreSQL connection string. Configure DATABASE_URL in the environment or .env.local file.';

function createMissingDatabaseClient(): DatabaseInstance {
  return new Proxy({} as DatabaseInstance, {
    get() {
      throw new Error(DATABASE_CONFIGURATION_ERROR);
    },
  });
}

function parsePoolConfig(databaseUrl: string): PoolConfig {
  const isSslRequired =
    databaseUrl.includes('sslmode=require') ||
    databaseUrl.includes('.neon.tech') ||
    process.env.NODE_ENV === 'production';

  return {
    connectionString: databaseUrl,
    ...(isSslRequired && !databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1')
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  };
}

export function createDb(databaseUrl: string): DatabaseInstance {
  if (!databaseUrl) {
    throw new Error('A database URL is required to create a database client.');
  }

  let pool = poolInstances.get(databaseUrl);
  if (!pool) {
    pool = new Pool(parsePoolConfig(databaseUrl));
    poolInstances.set(databaseUrl, pool);
  }

  return drizzle(pool, { schema });
}
/**
 * Server-only database accessor.
 * Returns the Drizzle ORM database client initialized with Neon PostgreSQL.
 * Keeps module imports and Next.js build-time adapter construction safe without
 * creating a network client. The returned lazy client throws the moment a
 * runtime query method is accessed when DATABASE_URL is missing.
 */
export function getDb(databaseUrlOverride?: string): DatabaseInstance {
  if (databaseUrlOverride) return createDb(databaseUrlOverride);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    _missingDbInstance ??= createMissingDatabaseClient();
    return _missingDbInstance;
  }
  if (_dbInstance) return _dbInstance;

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
      throw new Error(DATABASE_CONFIGURATION_ERROR);
    }
    const client = getDb();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
