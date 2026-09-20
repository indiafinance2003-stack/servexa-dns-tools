import { and, desc, eq, inArray } from 'drizzle-orm';
import { dbFromRequest } from '@/lib/db/request';
import {
  talentClients,
  talentJobs,
  type TalentJobRow,
  type TalentJobStatus,
} from '@/lib/db/schema';
import { recordTalentActivity } from './activity';
import {
  employmentTypeLabel,
  isPubliclyListedJob,
  isTalentJobStatus,
  jobStatusLabel,
  workModeLabel,
} from './catalog';
import { TalentNotFoundError, TalentValidationError } from './errors';
import { nextJobId } from './ids';
import type { TalentJobInput } from './schemas';

/**
 * Recruitment jobs.
 *
 * Owner-side reads return everything (including the client relationship).
 * Public reads go through `./public.ts`, which selects only the publishable
 * columns — a job's internal notes and client identity never leave this module
 * for an unauthenticated caller.
 */

export interface TalentJobDTO {
  id: string;
  jobId: string;
  clientId: string | null;
  clientName: string | null;
  title: string;
  description: string;
  employmentType: string;
  employmentTypeLabel: string;
  location: string | null;
  workMode: string;
  workModeLabel: string;
  experienceMin: number | null;
  experienceMax: number | null;
  /** Annual salary in integer minor units (paise), or null when unset. */
  salaryMinMinor: number | null;
  salaryMaxMinor: number | null;
  salaryCurrency: string;
  salaryPublic: boolean;
  openings: number;
  requiredSkills: string[];
  preferredSkills: string[];
  qualification: string | null;
  shift: string | null;
  noticePeriodRequirement: string | null;
  status: string;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

/** Normalizes a stored skills value into a string array. */
export function readSkillList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.length > 0)
    .slice(0, 40);
}

function toDTO(row: TalentJobRow, clientName: string | null = null): TalentJobDTO {
  return {
    id: row.id,
    jobId: row.jobId,
    clientId: row.clientId,
    clientName,
    title: row.title,
    description: row.description,
    employmentType: row.employmentType,
    employmentTypeLabel: employmentTypeLabel(row.employmentType),
    location: row.location,
    workMode: row.workMode,
    workModeLabel: workModeLabel(row.workMode),
    experienceMin: row.experienceMin,
    experienceMax: row.experienceMax,
    // Salary is stored in integer minor units (paise), consistent with every
    // other money column in this codebase.
    salaryMinMinor: row.salaryMin,
    salaryMaxMinor: row.salaryMax,
    salaryCurrency: row.salaryCurrency,
    salaryPublic: row.salaryPublic,
    openings: row.openings,
    requiredSkills: readSkillList(row.requiredSkills),
    preferredSkills: readSkillList(row.preferredSkills),
    qualification: row.qualification,
    shift: row.shift,
    noticePeriodRequirement: row.noticePeriodRequirement,
    status: row.status,
    statusLabel: jobStatusLabel(row.status),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
  };
}

function assertStatus(status: string): asserts status is TalentJobStatus {
  if (!isTalentJobStatus(status)) {
    throw new TalentValidationError(`Unknown job status: ${status}`);
  }
}

/** Salary inputs arrive in whole rupees; storage is integer minor units. */
function toMinor(rupees: number | undefined): number | null {
  if (rupees === undefined) return null;
  return rupees * 100;
}

/** Creates a job in DRAFT; publishing is explicit via setTalentJobStatus. */
export async function createTalentJob(actor: string | null, input: TalentJobInput) {
  const { db } = dbFromRequest();
  const code = await nextJobId();
  const [row] = await db.insert(talentJobs).values({
    jobId: code,
    clientId: input.clientId ?? null,
    title: input.title,
    description: input.description,
    employmentType: input.employmentType ?? 'full_time',
    location: input.location ?? null,
    workMode: input.workMode ?? 'onsite',
    experienceMin: input.experienceMin ?? null,
    experienceMax: input.experienceMax ?? null,
    salaryMin: toMinor(input.salaryMin),
    salaryMax: toMinor(input.salaryMax),
    salaryCurrency: input.salaryCurrency ?? 'INR',
    salaryPublic: input.salaryPublic ?? false,
    openings: input.openings ?? 1,
    requiredSkills: input.requiredSkills ?? [],
    preferredSkills: input.preferredSkills ?? [],
    qualification: input.qualification ?? null,
    shift: input.shift ?? null,
    noticePeriodRequirement: input.noticePeriodRequirement ?? null,
    status: 'DRAFT',
  }).returning();
  await recordTalentActivity(actor, {
    entityType: 'job', entityId: row.id,
    action: 'job_created', summary: `Job created: ${row.jobId}`,
    metadata: { title: row.title },
  });
  return toDTO(row);
}

/** Updates an editable job; id must be uuid (route asserts format). */
export async function updateTalentJob(actor: string | null, id: string, input: TalentJobInput) {
  const { db } = dbFromRequest();
  const rows = await db.update(talentJobs).set({
    clientId: input.clientId ?? null,
    title: input.title,
    description: input.description,
    employmentType: input.employmentType ?? 'full_time',
    location: input.location ?? null,
    workMode: input.workMode ?? 'onsite',
    experienceMin: input.experienceMin ?? null,
    experienceMax: input.experienceMax ?? null,
    salaryMin: toMinor(input.salaryMin),
    salaryMax: toMinor(input.salaryMax),
    salaryCurrency: input.salaryCurrency ?? 'INR',
    salaryPublic: input.salaryPublic ?? false,
    openings: input.openings ?? 1,
    requiredSkills: input.requiredSkills ?? [],
    preferredSkills: input.preferredSkills ?? [],
    qualification: input.qualification ?? null,
    shift: input.shift ?? null,
    noticePeriodRequirement: input.noticePeriodRequirement ?? null,
    updatedAt: new Date(),
  }).where(eq(talentJobs.id, id)).returning();
  const row = rows[0] ?? null;
  if (!row) throw new TalentNotFoundError('job');
  await recordTalentActivity(actor, {
    entityType: 'job', entityId: row.id,
    action: 'job_updated', summary: `Job updated: ${row.jobId}`,
    metadata: {},
  });
  return toDTO(row);
}

/** Publishes/pauses/closes a job with closedAt bookkeeping. */
export async function updateTalentJobStatus(actor: string | null, id: string, status: string) {
  assertStatus(status);
  const { db } = dbFromRequest();
  const closed = status === 'CLOSED' || status === 'FILLED' || status === 'CANCELLED';
  const rows = await db.update(talentJobs).set({
    status, updatedAt: new Date(), closedAt: closed ? new Date() : null,
  }).where(eq(talentJobs.id, id)).returning();
  const row = rows[0] ?? null;
  if (!row) throw new TalentNotFoundError('job');
  await recordTalentActivity(actor, {
    entityType: 'job', entityId: row.id,
    action: 'job_status_changed', summary: `Job ${row.jobId} -> ${status}`,
    metadata: { status },
  });
  return toDTO(row);
}

/** Owner job detail by uuid. */
export async function getTalentJob(id: string) {
  const { db } = dbFromRequest();
  const rows = await db.select().from(talentJobs).where(eq(talentJobs.id, id)).limit(1);
  const row = rows[0] ?? null;
  if (!row) throw new TalentNotFoundError('job');
  let clientName: string | null = null;
  if (row.clientId) {
    const c = await db.select().from(talentClients).where(eq(talentClients.id, row.clientId)).limit(1);
    clientName = c[0]?.companyName ?? null;
  }
  return toDTO(row, clientName);
}


export interface ListTalentJobsOptions {
  /** Free-text match on title, job code or location. */
  query?: string;
  status?: string;
  clientId?: string;
  limit?: number;
}

/**
 * Owner job list.
 *
 * Every filter is applied server-side and unknown status values are ignored
 * rather than passed through to SQL, so a hand-crafted query string cannot
 * widen the result set or reach the database as raw input.
 */
export async function listTalentJobs(options: ListTalentJobsOptions = {}) {
  const { db } = dbFromRequest();
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
  const filters = [];
  if (options.status && isTalentJobStatus(options.status)) {
    filters.push(eq(talentJobs.status, options.status));
  }
  if (options.clientId) {
    filters.push(eq(talentJobs.clientId, options.clientId));
  }
  const rows =
    filters.length > 0
      ? await db
          .select()
          .from(talentJobs)
          .where(and(...filters))
          .orderBy(desc(talentJobs.createdAt))
          .limit(limit)
      : await db.select().from(talentJobs).orderBy(desc(talentJobs.createdAt)).limit(limit);

  const needle = (options.query ?? '').trim();
  const matched = needle ? rows.filter((row) => matchesJobQuery(row, needle)) : rows;

  // Client names are resolved in one extra query rather than per row.
  const clientIds = [
    ...new Set(matched.map((row) => row.clientId).filter((value): value is string => Boolean(value))),
  ];
  const clientRows =
    clientIds.length > 0
      ? await db
          .select({ id: talentClients.id, name: talentClients.companyName })
          .from(talentClients)
          .where(inArray(talentClients.id, clientIds))
      : [];
  const clientNameById = new Map(clientRows.map((row) => [row.id, row.name]));

  return matched.map((row) =>
    toDTO(row, row.clientId ? clientNameById.get(row.clientId) ?? null : null)
  );
}

/** Duplicates a job as a fresh DRAFT with a new human code. */
export async function duplicateTalentJob(actor: string | null, id: string) {
  const { db } = dbFromRequest();
  const rows = await db.select().from(talentJobs).where(eq(talentJobs.id, id)).limit(1);
  const src = rows[0] ?? null;
  if (!src) throw new TalentNotFoundError('job');
  const code = await nextJobId();
  const [row] = await db.insert(talentJobs).values({
    jobId: code,
    clientId: src.clientId,
    title: `${src.title} (copy)`,
    description: src.description,
    employmentType: src.employmentType,
    location: src.location,
    workMode: src.workMode,
    experienceMin: src.experienceMin,
    experienceMax: src.experienceMax,
    salaryMin: src.salaryMin,
    salaryMax: src.salaryMax,
    salaryCurrency: src.salaryCurrency,
    salaryPublic: src.salaryPublic,
    openings: src.openings,
    requiredSkills: src.requiredSkills,
    preferredSkills: src.preferredSkills,
    qualification: src.qualification,
    shift: src.shift,
    noticePeriodRequirement: src.noticePeriodRequirement,
    status: 'DRAFT',
  }).returning();
  await recordTalentActivity(actor, {
    entityType: 'job', entityId: row.id,
    action: 'job_created', summary: `Job duplicated from ${src.jobId} as ${row.jobId}`,
    metadata: { source: src.id },
  });
  return toDTO(row);
}


/** Counts OPEN + PAUSED jobs for the owner dashboard. */
export async function countOpenJobs(): Promise<number> {
  const { db } = dbFromRequest();
  const rows = await db.select({ id: talentJobs.id }).from(talentJobs).where(inArray(talentJobs.status, ['OPEN', 'PAUSED']));
  return rows.length;
}

/** Filters a job list query for owner views. */
export function matchesJobQuery(row: TalentJobRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    row.title.toLowerCase().includes(needle) ||
    row.jobId.toLowerCase().includes(needle) ||
    (row.location ?? '').toLowerCase().includes(needle)
  );
}

export function publicJobMatches(
  row: TalentJobRow,
  opts: { q?: string; location?: string; workMode?: string; minExp?: number; maxExp?: number },
): boolean {
  if (!isPubliclyListedJob(row.status)) return false;
  if (opts.workMode && row.workMode !== opts.workMode) return false;
  if (opts.location && !(row.location ?? '').toLowerCase().includes(opts.location.toLowerCase())) return false;
  if (opts.q) {
    const needle = opts.q.toLowerCase();
    const hay = `${row.title} ${row.jobId} ${readSkillList(row.requiredSkills).join(' ')}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  if (opts.minExp !== undefined && (row.experienceMax ?? 99) < opts.minExp) return false;
  if (opts.maxExp !== undefined && (row.experienceMin ?? 0) > opts.maxExp) return false;
  return true;
}
