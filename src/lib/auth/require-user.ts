import 'server-only';
import { redirect } from 'next/navigation';
import { getSessionUser, type AuthenticatedUser } from './session';

/**
 * Server-side guard for protected pages. Redirects unauthenticated visitors
 * to /login (preserving no state; there is nothing sensitive to resume).
 */
export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

/**
 * Server-side guard for protected API routes. Returns null instead of
 * redirecting; callers must respond 401 and derive all authorization from
 * the returned user id — never from client-supplied identifiers.
 */
export async function requireApiUser(): Promise<AuthenticatedUser | null> {
  return getSessionUser();
}
