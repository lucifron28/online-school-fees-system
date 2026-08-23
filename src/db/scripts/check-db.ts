import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { logSanitizedError } from '../../server/logging';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function checkDatabaseConnection() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(
      '❌ Error: DATABASE_URL environment variable is missing. Please set DATABASE_URL in .env.local or environment.'
    );
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    console.log('🔄 Checking database connection to PostgreSQL...');
    await client.connect();
    const result = await client.query('SELECT NOW() as current_time, VERSION() as version;');
    console.log('✅ Database connection successful!');
    console.log('Timestamp:', result.rows[0]?.current_time);
    console.log('Version:', result.rows[0]?.version);
  } catch (error) {
    logSanitizedError('database.connection_check', error);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
}

void checkDatabaseConnection();
