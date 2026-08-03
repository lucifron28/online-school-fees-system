import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema/index';

export type DatabaseInstance = NeonHttpDatabase<typeof schema>;

let _dbInstance: DatabaseInstance | null = null;

/**
 * Server-only database accessor.
 * Returns the Drizzle ORM database client initialized with Neon PostgreSQL.
 * Throws a clear configuration error if DATABASE_URL is not set when database operations are invoked.
 */
export function getDb(): DatabaseInstance {
  if (_dbInstance) return _dbInstance;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is missing. Database access requires a valid Neon PostgreSQL connection string. Please configure DATABASE_URL in your environment or .env.local file.'
    );
  }

  const sql: NeonQueryFunction<boolean, boolean> = neon(databaseUrl);
  _dbInstance = drizzle(sql, { schema });
  return _dbInstance;
}

/**
 * Backward-compatible proxy for `db`.
 * Accessing any database method or property invokes `getDb()` at runtime.
 */
export const db = new Proxy({} as DatabaseInstance, {
  get(_target, prop, receiver) {
    const client = getDb();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
