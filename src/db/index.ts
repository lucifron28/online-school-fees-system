import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { drizzle, NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema/index';

export type DatabaseInstance = NeonHttpDatabase<typeof schema>;

let _dbInstance: DatabaseInstance | null = null;

/**
 * Server-only database accessor.
 * Returns the Drizzle ORM database client initialized with Neon PostgreSQL.
 * Allows build-time initialization without requiring an active database connection.
 * Throws a clear configuration error if DATABASE_URL is not set when a database operation is actually invoked at runtime.
 */
export function getDb(): DatabaseInstance {
  if (_dbInstance) return _dbInstance;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    const placeholderUrl =
      'postgresql://build_placeholder:build_placeholder@localhost:5432/build_placeholder';
    const sql = neon(placeholderUrl);
    _dbInstance = drizzle(sql, { schema });
    return _dbInstance;
  }

  const sql: NeonQueryFunction<boolean, boolean> = neon(databaseUrl);
  _dbInstance = drizzle(sql, { schema });
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
