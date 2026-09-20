import 'server-only';
import type { AppDatabase } from '@/lib/db';
import { dbFromRequest } from '@/lib/db/request';
import { talentApplications, talentCandidates, talentJobs } from '@/lib/db/schema';

/**
 * Human-readable recruitment identifiers.
 *
 * Internal UUID primary keys stay internal: candidates, jobs and applications
 * are referred to by JOB-001 / CAN-000001 / APP-000001 in the Owner Room, in
 * notifications and (for jobs) on the public site. The database columns carry a
 * unique constraint, so a collision fails the insert rather than overwriting.
 *
 * Sequences are derived from the highest existing value, which is correct for a
 * single-writer Owner Room. `nextSequence` is exported so the allocation logic
 * is unit-testable without a database.
 */

export const JOB_ID_PREFIX = 'JOB';
export const CANDIDATE_ID_PREFIX = 'CAN';
export const APPLICATION_ID_PREFIX = 'APP';

export const JOB_ID_PATTERN = /^JOB-\d{3,}$/;
export const CANDIDATE_ID_PATTERN = /^CAN-\d{6,}$/;
export const APPLICATION_ID_PATTERN = /^APP-\d{6,}$/;

/** Formats a sequence number with the given padding. */
export function formatSequence(prefix: string, sequence: number, padding: number): string {
  const safe = Number.isFinite(sequence) && sequence > 0 ? Math.floor(sequence) : 1;
  return `${prefix}-${String(safe).padStart(padding, '0')}`;
}

/**
 * Calculates the next sequence from the highest existing identifier.
 * Values that do not match the expected shape are ignored, so a hand-edited
 * row can never push the sequence to NaN or a negative number.
 */
export function nextSequence(existing: Array<string | null | undefined>, pattern: RegExp): number {
  let highest = 0;
  for (const value of existing) {
    if (typeof value !== 'string' || !pattern.test(value)) continue;
    const parsed = Number.parseInt(value.slice(value.lastIndexOf('-') + 1), 10);
    if (Number.isFinite(parsed) && parsed > highest) highest = parsed;
  }
  return highest + 1;
}

/** Allocates the next JOB-nnn identifier. */
export async function nextJobId(db?: AppDatabase): Promise<string> {
  const database = db ?? dbFromRequest().db;
  const rows = await database.select({ value: talentJobs.jobId }).from(talentJobs);
  return formatSequence(JOB_ID_PREFIX, nextSequence(rows.map((r) => r.value), JOB_ID_PATTERN), 3);
}

/** Allocates the next CAN-nnnnnn identifier. */
export async function nextCandidateId(db?: AppDatabase): Promise<string> {
  const database = db ?? dbFromRequest().db;
  const rows = await database.select({ value: talentCandidates.candidateId }).from(talentCandidates);
  return formatSequence(
    CANDIDATE_ID_PREFIX,
    nextSequence(rows.map((r) => r.value), CANDIDATE_ID_PATTERN),
    6
  );
}

/** Allocates the next APP-nnnnnn identifier. */
export async function nextApplicationId(db?: AppDatabase): Promise<string> {
  const database = db ?? dbFromRequest().db;
  const rows = await database
    .select({ value: talentApplications.applicationId })
    .from(talentApplications);
  return formatSequence(
    APPLICATION_ID_PREFIX,
    nextSequence(rows.map((r) => r.value), APPLICATION_ID_PATTERN),
    6
  );
}