import 'server-only';
import { cookies } from 'next/headers';
import { and, eq, gt, lt } from 'drizzle-orm';
import { getDatabase } from '@/lib/db';
import { sessions, users, type UserRow } from '@/lib/db/schema';
import { generateSessionToken, hashSessionToken } from './tokens';

export const SESSION_COOKIE_NAME = 'ravelyth_session';
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  lastLoginAt: Date | null;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

/**
 * Creates a database-backed session and sets the HttpOnly session cookie.
 * The raw token is returned only at creation time; afterwards only the hash
 * is ever stored or compared.
 */
export async function createSession(userId: string): Promise<void> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  const { db } = getDatabase();
  await db.insert(sessions).values({ userId, tokenHash, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(Math.floor(SESSION_TTL_MS / 1000)));

  // Opportunistic cleanup of expired rows; failures here must never break a
  // successful login/registration.
  try {
    await deleteExpiredSessions();
  } catch {
    // ignore cleanup failures
  }
}

/** Deletes the current session (if any), clears the cookie. */
export async function destroySession(): Promise<boolean> {
  const token = await readSessionToken();
  if (!token) return false;

  const { db } = getDatabase();
  const deleted = await db
    .delete(sessions)
    .where(eq(sessions.tokenHash, hashSessionToken(token)))
    .returning({ id: sessions.id });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', sessionCookieOptions(0));
  return deleted.length > 0;
}

async function readSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return token && token.length > 0 ? token : null;
}

function toAuthenticatedUser(row: UserRow): AuthenticatedUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt,
  };
}

/**
 * Resolves the authenticated user from the session cookie, enforcing server
 * side expiration. Never trusts any browser-supplied user identifier.
 * Returns null when unauthenticated or when the session is expired/invalid.
 */
export async function getSessionUser(): Promise<AuthenticatedUser | null> {
  const token = await readSessionToken();
  if (!token) return null;

  let rows: Array<{ user: UserRow; sessionId: string; lastSeenAt: Date }> = [];
  try {
    const { db } = getDatabase();
    rows = await db
      .select({ user: users, sessionId: sessions.id, lastSeenAt: sessions.lastSeenAt })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.tokenHash, hashSessionToken(token)),
          gt(sessions.expiresAt, new Date()),
          eq(users.status, 'active')
        )
      )
      .limit(1);
  } catch {
    // Any failure (database unconfigured or unreachable) resolves to
    // "unauthenticated" so public pages keep working without PostgreSQL.
    return null;
  }

  const row = rows[0];
  if (!row) return null;

  // Throttled "last seen" touch: at most once per minute per session.
  if (Date.now() - row.lastSeenAt.getTime() > 60_000) {
    try {
      const { db } = getDatabase();
      await db
        .update(sessions)
        .set({ lastSeenAt: new Date() })
        .where(eq(sessions.id, row.sessionId));
    } catch {
      // non-fatal
    }
  }

  return toAuthenticatedUser(row.user);
}

export async function deleteExpiredSessions(): Promise<number> {
  const { db } = getDatabase();
  const deleted = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .returning({ id: sessions.id });
  return deleted.length;
}
