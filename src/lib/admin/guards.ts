import 'server-only';
import { getSessionUser } from '@/lib/auth/session';
import { users, type UserRow } from '@/lib/db/schema';
import { getDatabase } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { AppError, AppErrorCode } from '@/lib/errors/app-error';
import { logger } from '@/lib/logging/logger';

/** User role values. */
export const USER_ROLES = ['customer', 'staff', 'owner'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Resolves the authenticated user (including their role) from the session.
 * Identity is always derived server-side from the HttpOnly session cookie;
 * the client can never set its own role. Returns null when unauthenticated
 * or when the database is unavailable.
 */
export async function getCurrentUser(): Promise<UserRow | null> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;

  try {
    const { db } = getDatabase();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.id, sessionUser.id))
      .limit(1);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Requires the current session user to have one of the given roles.
 * Throws AppError(401) if unauthenticated, AppError(403) if unauthorized.
 */
export async function requireRole(roles: UserRole[]): Promise<UserRow> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, 'Authentication required', 401);
  }
  if (!roles.includes(user.role as UserRole)) {
    logger.warn('Unauthorized role access attempt', {
      userId: user.id,
      requiredRoles: roles,
      userRole: user.role,
    });
    throw new AppError(AppErrorCode.FORBIDDEN, 'Insufficient permissions', 403);
  }
  return user;
}

/** Requires owner role. */
export async function requireOwner(): Promise<UserRow> {
  return requireRole(['owner']);
}

/** Requires staff or owner. */
export async function requireStaffOrOwner(): Promise<UserRow> {
  return requireRole(['staff', 'owner']);
}

/** Checks if the current user has one of the specified roles (boolean). */
export async function hasRole(roles: UserRole[]): Promise<boolean> {
  try {
    await requireRole(roles);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the session user (throws if not authenticated), for routes that
 * require login but no specific role.
 */
export async function requireAuthenticatedUser(): Promise<UserRow> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, 'Authentication required', 401);
  }
  return user;
}