import 'server-only';
import type { AuthenticatedUser } from '@/lib/auth/session';
import { getSessionUser } from '@/lib/auth/session';

/**
 * Resolves the authenticated caller for Next.js API route handlers.
 *
 * This is intentionally a small, explicit bridge over the existing session
 * authentication path. It does not introduce a parallel authentication
 * provider, API-key system, or database client.
 *
 * - The resolved user is always derived server-side from the HttpOnly session
 *   cookie, never from the request body, path, query, or client state.
 *
 * Callers that need a database handle should use `dbFromRequest()` from
 * `@/lib/db/request` instead of reaching into auth state for a connection.
 */
export async function authenticatedRequest(): Promise<{
  user: AuthenticatedUser | null;
  authType: 'session' | 'none';
}> {
  const user = await getSessionUser();
  if (user) {
    return { user, authType: 'session' };
  }
  return { user: null, authType: 'none' };
}

/**
 * Convenience helper used by some route handlers that want a single combined
 * authenticated caller object. Still derives identity from the session cookie
 * only; it never trusts any caller-supplied user identifier.
 */
export async function authenticatedCaller(): Promise<{
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
}> {
  const user = await getSessionUser();
  return { user, isAuthenticated: user !== null };
}