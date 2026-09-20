import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { dbFromRequest } from '@/lib/db/request';
import { talentInterviews, type TalentInterviewRow } from '@/lib/db/schema';
import { recordTalentActivity } from './activity';
import { isTalentInterviewStatus } from './catalog';
import { TalentNotFoundError, TalentValidationError } from './errors';
import type { TalentInterviewInput } from './schemas';
import { talentInterviewUpdateSchema } from './schemas';
import type { z } from 'zod';

export type TalentInterviewUpdate = z.infer<typeof talentInterviewUpdateSchema>;


export interface TalentInterviewDTO {
  id: string;
  applicationId: string;
  round: string;
  scheduledAt: string | null;
  interviewType: string;
  meetingLink: string | null;
  interviewer: string | null;
  status: string;
  feedback: string | null;
  createdAt: string;
  updatedAt: string;
}

function toDTO(row: TalentInterviewRow): TalentInterviewDTO {
  return {
    id: row.id,
    applicationId: row.applicationId,
    round: row.round,
    scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
    interviewType: row.interviewType,
    meetingLink: row.meetingLink,
    interviewer: row.interviewer,
    status: row.status,
    feedback: row.feedback,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function getApplicationOrThrow(applicationId: string) {
  const { db } = dbFromRequest();
  const { talentApplications } = await import('@/lib/db/schema');
  const rows = await db.select().from(talentApplications).where(eq(talentApplications.id, applicationId)).limit(1);
  const app = rows[0] ?? null;
  if (!app) throw new TalentNotFoundError('application');
  return app;
}

export async function scheduleInterview(actor: string | null, input: TalentInterviewInput): Promise<TalentInterviewDTO> {
  await getApplicationOrThrow(input.applicationId);
  const { db } = dbFromRequest();
  const scheduledAt = toDate(input.scheduledAt);
  const [row] = await db.insert(talentInterviews).values({
    applicationId: input.applicationId,
    round: input.round.trim(),
    scheduledAt,
    interviewType: input.interviewType ?? 'video',
    meetingLink: input.meetingLink ?? null,
    interviewer: input.interviewer ?? null,
    status: 'SCHEDULED',
    feedback: input.feedback ?? null,
  }).returning();
  await recordTalentActivity(actor, {
    entityType: 'interview', entityId: row.id, action: 'interview_scheduled',
    summary: `Interview scheduled: ${row.round}`,
    metadata: { applicationId: input.applicationId, status: 'SCHEDULED' },
  });
  return toDTO(row);
}

export async function updateInterview(actor: string | null, id: string, patch: TalentInterviewUpdate): Promise<TalentInterviewDTO> {
  const { db } = dbFromRequest();
  const rows = await db.select().from(talentInterviews).where(eq(talentInterviews.id, id)).limit(1);
  const existing = rows[0] ?? null;
  if (!existing) throw new TalentNotFoundError('interview');
  if (patch.status !== undefined && !isTalentInterviewStatus(patch.status)) {
    throw new TalentValidationError(`Unknown interview status: ${patch.status}`);
  }
  const wasCompleted = patch.status === 'COMPLETED' || patch.status === 'PASSED' || patch.status === 'FAILED';
  const [row] = await db.update(talentInterviews).set({
    scheduledAt: patch.scheduledAt === undefined ? existing.scheduledAt : toDate(patch.scheduledAt),
    interviewType: patch.interviewType ?? existing.interviewType,
    meetingLink: patch.meetingLink === undefined ? existing.meetingLink : (patch.meetingLink ?? null),
    interviewer: patch.interviewer === undefined ? existing.interviewer : (patch.interviewer ?? null),
    status: patch.status ?? existing.status,
    feedback: patch.feedback === undefined ? existing.feedback : (patch.feedback ?? null),
    updatedAt: new Date(),
  }).where(eq(talentInterviews.id, id)).returning();
  await recordTalentActivity(actor, {
    entityType: 'interview', entityId: id,
    action: wasCompleted ? 'interview_completed' : 'interview_updated',
    summary: `Interview ${row.round}: ${existing.status} -> ${row.status}`,
    metadata: { from: existing.status, to: row.status, applicationId: row.applicationId },
  });
  return toDTO(row);
}

export async function listInterviews(opts: { applicationId?: string; upcomingOnly?: boolean; limit?: number } = {}): Promise<TalentInterviewDTO[]> {
  const { db } = dbFromRequest();
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 200);
  const rows = opts.applicationId
    ? await db.select().from(talentInterviews).where(eq(talentInterviews.applicationId, opts.applicationId)).orderBy(desc(talentInterviews.scheduledAt)).limit(limit)
    : await db.select().from(talentInterviews).orderBy(desc(talentInterviews.scheduledAt)).limit(limit);
  const list = opts.upcomingOnly ? rows.filter((r) => r.status === 'SCHEDULED' || r.status === 'RESCHEDULED') : rows;
  return list.map(toDTO);
}

export async function getTalentInterview(id: string): Promise<TalentInterviewDTO> {
  const { db } = dbFromRequest();
  const rows = await db.select().from(talentInterviews).where(eq(talentInterviews.id, id)).limit(1);
  const row = rows[0] ?? null;
  if (!row) throw new TalentNotFoundError('interview');
  return toDTO(row);
}

export async function countUpcomingInterviews(): Promise<number> {
  const rows = await listInterviews({ upcomingOnly: true, limit: 200 });
  return rows.length;
}

