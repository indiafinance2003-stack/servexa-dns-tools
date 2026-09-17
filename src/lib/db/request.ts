import 'server-only';
import type { AppDatabase } from './index';
import { requireDatabase } from './require-database';

/**
 * Request-side database access helper for server API handlers.
 *
 * This does not create a parallel database client or introduce request-scoped
 * connection management. It reuses the existing module-level database singleton
 * via `requireDatabase()`.
 *
 * The existing application database is cached and created lazily on first use,
 * so callers should resolve it through this helper only when they want a single
 * consistent import path for API routes.
 */
export function dbFromRequest(): { db: AppDatabase } {
  return { db: requireDatabase().db };
}
