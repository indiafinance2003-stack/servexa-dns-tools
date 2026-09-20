import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { dbFromRequest } from '@/lib/db/request';
import { talentJobs, type TalentJobRow } from '@/lib/db/schema';
import { isPubliclyListedJob } from './catalog';
import { JOB_ID_PATTERN, JOB_ID_PREFIX } from './ids';
import { TalentNotFoundError } from './errors';

function normalizeJobCode(jobCode: string): string {
  const normalized = `${JOB_ID_PREFIX}-${jobCode.trim().replace(/^job-/i, '').padStart(3, '0')}`;
  if (!JOB_ID_PATTERN.test(normalized)) throw new TalentNotFoundError('job');
  return normalized;
}
import { publicJobMatches, readSkillList } from './jobs';

export interface PublicJobDTO {
  id: string;
  jobCode: string;
  title: string;
  description: string;
  employmentType: string;
  location: string | null;
  workMode: string;
  experienceMin: number | null;
  experienceMax: number | null;
  salaryMinMinor: number | null;
  salaryMaxMinor: number | null;
  salaryCurrency: string;
  openings: number;
  requiredSkills: string[];
  preferredSkills: string[];
  qualification: string | null;
  shift: string | null;
  postedAt: string;
}

function toPublicDTO(row: TalentJobRow): PublicJobDTO {
  return {
    id: row.id,
    jobCode: row.jobId,
    title: row.title,
    description: row.description,
    employmentType: row.employmentType,
    location: row.location,
    workMode: row.workMode,
    experienceMin: row.experienceMin,
    experienceMax: row.experienceMax,
    salaryMinMinor: row.salaryPublic ? row.salaryMin : null,
    salaryMaxMinor: row.salaryPublic ? row.salaryMax : null,
    salaryCurrency: row.salaryCurrency,
    openings: row.openings,
    requiredSkills: readSkillList(row.requiredSkills),
    preferredSkills: readSkillList(row.preferredSkills),
    qualification: row.qualification,
    shift: row.shift,
    postedAt: row.createdAt.toISOString(),
  };
}

/**
 * Formats a salary band stored in integer minor units (paise) for public
 * display. Returns null when the band is intentionally not published.
 */
export function formatSalaryRangeMinor(
  minMinor: number | null,
  maxMinor: number | null
): string | null {
  if (minMinor === null && maxMinor === null) return null;
  const format = (minor: number | null) =>
    minor === null ? null : `₹${(minor / 100).toLocaleString('en-IN')}`;
  const min = format(minMinor);
  const max = format(maxMinor);
  if (min !== null && max !== null) return `${min} – ${max}`;
  return min ?? max;
}

/** Formats an experience band as "3–5 years" style copy. */
export function formatExperienceBand(min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null && min === max) return `${min} years`;
  if (min !== null && max !== null) return `${min}–${max} years`;
  if (min !== null) return `${min}+ years`;
  return `Up to ${max} years`;
}

export interface PublicJobFilters {
  q?: string;
  location?: string;
  workMode?: string;
  minExperience?: number;
  maxExperience?: number;
}

export async function listPublicJobs(filters: PublicJobFilters = {}): Promise<PublicJobDTO[]> {
  const { db } = dbFromRequest();
  const rows = await db.select().from(talentJobs).orderBy(desc(talentJobs.createdAt)).limit(200);
  return rows
    .filter((row) => publicJobMatches(row, { q: filters.q, location: filters.location, workMode: filters.workMode, minExp: filters.minExperience, maxExp: filters.maxExperience }))
    .map(toPublicDTO);
}

export async function getPublicJob(jobUuid: string): Promise<PublicJobDTO> {
  const { db } = dbFromRequest();
  const rows = await db.select().from(talentJobs).where(eq(talentJobs.id, jobUuid)).limit(1);
  const row = rows[0] ?? null;
  if (!row || !isPubliclyListedJob(row.status)) throw new TalentNotFoundError('job');
  return toPublicDTO(row);
}

/**
 * Resolves a published job by its human-readable code (e.g. JOB-000001) for
 * public detail pages. Unpublished or unknown codes are indistinguishable 404s
 * so draft jobs cannot be probed by iterating codes.
 */
export async function getPublicJobByCode(jobCode: string): Promise<PublicJobDTO> {
  const { db } = dbFromRequest();
  const normalized = normalizeJobCode(jobCode);
  const rows = await db.select().from(talentJobs).where(eq(talentJobs.jobId, normalized)).limit(1);
  const row = rows[0] ?? null;
  if (!row || !isPubliclyListedJob(row.status)) throw new TalentNotFoundError('job');
  return toPublicDTO(row);
}

/** Internal uuid for a published job code — used by the public apply route. */
export async function resolvePublicJobUuid(jobCode: string): Promise<string> {
  const { db } = dbFromRequest();
  const normalized = normalizeJobCode(jobCode);
  const rows = await db
    .select({ id: talentJobs.id, status: talentJobs.status })
    .from(talentJobs)
    .where(eq(talentJobs.jobId, normalized))
    .limit(1);
  const row = rows[0] ?? null;
  if (!row || !isPubliclyListedJob(row.status)) throw new TalentNotFoundError('job');
  return row.id;
}
