import 'server-only';
import { and, eq } from 'drizzle-orm';
import { dbFromRequest } from '@/lib/db/request';
import { users } from '@/lib/db/schema';
import { config } from '@/lib/config';
import { recordAudit } from '@/lib/control/audit';
import { normalizeEmail } from './schemas';

/**
 * Owner bootstrap.
 *
 * The owner role is a deployment decision, not a registration decision, so it
 * is granted exclusively from the OWNER_EMAIL environment setting whenever the
 * matching account signs in. The role is never client-settable and a normal
 * account registration can never claim it.
 */

/** Whether an email is the configured bootstrap owner. Empty OWNER_EMAIL
 * (the default) means bootstrap is disabled. */
export function isOwnerEmail(email: string): boolean {
  const ownerEmail = config.OWNER_EMAIL ? normalizeEmail(config.OWNER_EMAIL) : '';
  return ownerEmail !== '' && normalizeEmail(email) === ownerEmail;
}

/**
 * Grants the owner role at sign-in to the account whose email matches
 * OWNER_EMAIL. Idempotent and never downgrades an existing role. Called after
 * a successful login or registration; fails silent if the database is
 * unavailable so bootstrap can never block authentication.
 */
export async function promoteOwnerIfConfigured(
  userId: string,
  email: string
): Promise<void> {
  if (!isOwnerEmail(email)) return;
  try {
    const { db } = dbFromRequest();
    const rows = await db
      .update(users)
      .set({ role: 'owner', updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.email, normalizeEmail(email))))
      .returning({ id: users.id, role: users.role });
    const row = rows[0];
    if (!row || row.role !== 'owner') return;
    await recordAudit(userId, {
      action: 'owner_role_granted',
      description: 'Owner role granted via OWNER_EMAIL bootstrap at sign-in.',
      severity: 'info',
      metadata: { userId },
    });
  } catch {
    // Bootstrap must never break sign-in.
  }
}