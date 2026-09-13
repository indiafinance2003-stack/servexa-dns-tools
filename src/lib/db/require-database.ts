import 'server-only';
import { AppError, AppErrorCode } from '@/lib/errors/app-error';
import { getDatabase, type Database } from './index';

/**
 * Returns the database connection or throws a user-safe 503 AppError when
 * PostgreSQL is not configured. API routes use this so that account features
 * degrade with a clear message instead of an internal error, while public
 * DNS/email tools remain fully functional without a database.
 */
export function requireDatabase(): Database {
  try {
    return getDatabase();
  } catch (error) {
    if (error instanceof Error && error.name === 'DatabaseNotConfiguredError') {
      throw new AppError(
        AppErrorCode.SERVICE_UNAVAILABLE,
        'Account features are temporarily unavailable. Public tools remain available.',
        503
      );
    }
    throw error;
  }
}
