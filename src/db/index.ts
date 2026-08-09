import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { Pool } from 'pg';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index';

export type DatabaseInstance = NeonHttpDatabase<typeof schema>;

let _dbInstance: DatabaseInstance | null = null;
let _missingDbInstance: DatabaseInstance | null = null;
const localPoolInstances = new Map<string, Pool>();

export const DATABASE_CONFIGURATION_ERROR =
  'DATABASE_URL environment variable is missing. Runtime database access requires a valid PostgreSQL connection string. Configure DATABASE_URL in the environment or .env.local file.';

function createMissingDatabaseClient(): DatabaseInstance {
  return new Proxy({} as DatabaseInstance, {
    get() {
      throw new Error(DATABASE_CONFIGURATION_ERROR);
    },
  });
}

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
