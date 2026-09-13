import 'dotenv/config';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import path from 'path';

/**
 * Applies queued SQL migrations in ./drizzle to the database referenced by
 * DATABASE_URL. Usage: npm run db:migrate
 */
async function run(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Nothing was migrated.');
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);
  const migrationsFolder = path.join(process.cwd(), 'drizzle');

  try {
    await migrate(db, { migrationsFolder });
    console.log('Migrations applied successfully.');
  } finally {
    await sql.end();
  }
}

run().catch((error: unknown) => {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
