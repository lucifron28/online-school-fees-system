import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema/index';

function createDbClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    // Return a lazy proxy or dummy instance during static build when DATABASE_URL is omitted
    return null as unknown as ReturnType<typeof drizzle>;
  }
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

export const db = createDbClient();
