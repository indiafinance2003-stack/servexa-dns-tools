import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { dbFromRequest } from '@/lib/db/request';
import type { AppDatabase } from '@/lib/db';
import { talentActivityLog, type TalentActivityRow } from '@/lib/db/schema';
import { logger } from '@/lib/logging/logger';

/**
 * Ravelyth Talent activity trail.
 *
 * Every meaningful recruitment action is appended here so the Owner Room can
 * show what actually happened, in order, without reconstructing it from current
 * state. Entries are append-only and never updated or deleted by application
 * code.
 *
 * Logging failures are swallowed (and warned about) for the same reason audit
 * logging is best-effort: a history write must never roll back the business
 * action it describes.
 */

export const TALENT_ACTIVITY_ACTIONS = [
  'client_created',
  'client_updated',
  'client_status_changed',
  'job_created',
  'job_updated',
  'job_status_changed',
  'candidate_created',
  'candidate_updated',
  'candidate_archived',
  'candidate_contacted',
  'candidate_confirmed',
  'application_created',
  'application_status_changed',
  'application_note_added',
  'client_submission',
  'interview_scheduled',
  'interview_updated',
  'interview_completed',
  'candidate_selected',
  'offer_received',
  'candidate_joined',
  'placement_created',
  'placement_updated',
  'payment_status_changed',
  'document_uploaded',
  'document_accessed',
] as const;

export type TalentActivityAction = (typeof TALENT_ACTIVITY_ACTIONS)[number];

export const TALENT_ENTITY_TYPES = [
  'client',
  'job',
  'candidate',
  'application',
  'interview',
  'placement',
  'document',
] as const;

export type TalentEntityType = (typeof TALENT_ENTITY_TYPES)[number];

export interface TalentActivityInput {
  entityType: TalentEntityType;
  entityId: string;
  action: TalentActivityAction;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}

/** Appends one activity entry. Best-effort: never throws into the caller. */
export async function recordTalentActivity(
  actorUserId: string | null,
  entry: TalentActivityInput,
  db?: AppDatabase
): Promise<void> {
  try {
    const database = db ?? dbFromRequest().db;
    await database.insert(talentActivityLog).values({
      actorUserId: actorUserId ?? null,
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      summary: entry.summary ? entry.summary.slice(0, 500) : null,
      metadata: entry.metadata ?? {},
    });
  } catch (error) {
    logger.warn('Talent activity log write failed', {
      action: entry.action,
      entityType: entry.entityType,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}

/** Most recent activity across the whole vertical (Owner dashboard). */
export async function listRecentTalentActivity(limit = 25): Promise<TalentActivityRow[]> {
  const { db } = dbFromRequest();
  return db
    .select()
    .from(talentActivityLog)
    .orderBy(desc(talentActivityLog.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}

/** Activity for one specific record (Owner detail pages). */
export async function listEntityActivity(
  entityType: TalentEntityType,
  entityId: string,
  limit = 25
): Promise<TalentActivityRow[]> {
  const { db } = dbFromRequest();
  return db
    .select()
    .from(talentActivityLog)
    .where(
      and(
        eq(talentActivityLog.entityType, entityType),
        eq(talentActivityLog.entityId, entityId)
      )
    )
    .orderBy(desc(talentActivityLog.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}