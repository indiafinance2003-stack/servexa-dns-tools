import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super('DATABASE_URL is not configured');
    this.name = 'DatabaseNotConfiguredError';
  }
}

export interface Database {
  sql: postgres.Sql;
  db: ReturnType<typeof drizzle<typeof schema>>;
}

let cached: Database | undefined;

/**
 * Lazy, cached database client. The connection is only created on first use so
 * that the application can build and serve public pages without a database,
 * and so credentials never reach the browser bundle ("server-only" guard).
 */
export function getDatabase(): Database {
  if (cached) return cached;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new DatabaseNotConfiguredError();
  }

  const sql = postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    // Supervised reuse of connections across requests in the same process.
    prepare: false,
  });

  const db = drizzle(sql, { schema });
  cached = { sql, db };
  return cached;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export type AppDatabase = ReturnType<typeof drizzle<typeof schema>>;
