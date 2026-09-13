import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is not set. Copy .env.example to .env.local and configure a PostgreSQL connection string.'
  );
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/ravelyth',
  },
  strict: true,
  verbose: true,
});
