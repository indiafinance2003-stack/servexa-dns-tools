import 'server-only';
import { and, eq, desc, sql } from 'drizzle-orm';
import { getDatabase, type AppDatabase } from '@/lib/db';
import { auditLog, type AuditLogRow } from '@/lib/db/schema';

/** Action types recorded in the audit log. */
export const AUDIT_ACTIONS = [
  'license_issued',
  'license_activated',
  'license_revoked',
  'license_status_changed',
  'server_registered',
  'server_unregistered',
  'server_status_changed',
  'agent_nonce_issued',
  'agent_nonce_consumed',
  'admin_action',
  'impersonation_start',
  'impersonation_end',
  'security_setting_changed',
  'owner_role_granted',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Severity levels for audit entries. */
export const AUDIT_SEVERITY = ['info', 'warn', 'critical'] as const;
export type AuditSeverity = (typeof AUDIT_SEVERITY)[number];

export interface AuditEntryInput {
  action: AuditAction;
  description?: string | null;
  severity?: AuditSeverity;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Records a security-sensitive audit event.
 * Called by server-side code only (never client-side).
 *
 * If the database is unavailable, audit entries are silently dropped —
 * the caller proceeds without a database dependency so that audit logging
 * never breaks a user-facing operation.
 */
export async function recordAudit(
  actorUserId: string | null,
  entry: AuditEntryInput,
  db?: AppDatabase
): Promise<void> {
  const database = db ?? getDatabase().db;
  try {
    await database.insert(auditLog).values({
      actorUserId: actorUserId ?? null,
      action: entry.action,
      description: entry.description ?? null,
      ipAddress: entry.ipAddress ?? null,
      metadata: entry.metadata ?? {},
      createdAt: sql`NOW()`,
    });
  } catch {
    // Audit logging must never break the calling operation.
    // This is intentionally swallowed.
  }
}

/**
 * Retrieves audit log entries for internal/admin tooling.
 * Scope is enforced server-side by the caller via admin guards.
 */
export async function getAuditEntries(params: {
  actorUserId?: string | null;
  action?: AuditAction | null;
  limit?: number;
  offset?: number;
  db?: AppDatabase;
}): Promise<AuditLogRow[]> {
  const database = params.db ?? getDatabase().db;
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const offset = Math.max(params.offset ?? 0, 0);

  const filters = [];
  if (params.actorUserId) filters.push(eq(auditLog.actorUserId, params.actorUserId));
  if (params.action) filters.push(eq(auditLog.action, params.action));

  if (filters.length > 0) {
    return await database
      .select()
      .from(auditLog)
      .where(and(...filters))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);
  }
  return await database
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .offset(offset);
}
