import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { dbFromRequest } from '@/lib/db/request';
import { config } from '@/lib/config';
import {
  talentApplications,
  talentCandidates,
  talentDocuments,
  talentJobs,
  type TalentApplicationRow,
  type TalentCandidateRow,
} from '@/lib/db/schema';
import { recordTalentActivity } from './activity';
import { isPubliclyListedJob } from './catalog';
import {
  TalentApplicationLimitError,
  TalentDuplicateApplicationError,
  TalentInvalidDocumentError,
  TalentInvalidTransitionError,
  TalentJobNotOpenError,
  TalentNotFoundError,
  TalentSubmissionBlockedError,
  TalentValidationError,
} from './errors';
import { nextApplicationId, nextCandidateId } from './ids';
import { isConfirmationGateBlocked, canTransitionApplication, isActiveApplicationStatus } from './policy';
import { readSkillList } from './jobs';
import type {
  TalentApplicationInput,
  TalentApplicationSubmission,
  TalentCandidateInput,
} from './schemas';
import { hasPlausibleSignature, validateResumeUpload } from './uploads';
import { writeDocumentFile } from './storage';
import type { TalentApplicationDTO, TalentCandidateDTO } from './dto';

export function toCandidateDTO(row: TalentCandidateRow): TalentCandidateDTO {
  return {
    id: row.id,
    candidateId: row.candidateId,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    whatsapp: row.whatsapp,
    currentLocation: row.currentLocation,
    preferredLocation: row.preferredLocation,
    totalExperience: row.totalExperience,
    relevantExperience: row.relevantExperience,
    currentCompany: row.currentCompany,
    currentCtc: row.currentCtc,
    expectedCtc: row.expectedCtc,
    noticePeriod: row.noticePeriod,
    highestQualification: row.highestQualification,
    skills: readSkillList(row.skills),
    linkedinUrl: row.linkedinUrl,
    preferredWorkMode: row.preferredWorkMode,
    shiftPreference: row.shiftPreference,
    relocationPreference: row.relocationPreference,
    source: row.source,
    consentStatus: row.consentStatus,
    internalNotes: row.internalNotes,
    archived: row.archivedAt !== null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toApplicationDTO(
  row: TalentApplicationRow,
  candidate: { id: string; candidateId: string },
  job: { id: string; jobId: string; title: string },
): TalentApplicationDTO {
  return {
    id: row.id,
    applicationId: row.applicationId,
    candidateId: row.candidateId,
    candidateCode: candidate.candidateId,
    jobId: row.jobId,
    jobCode: job.jobId,
    jobTitle: job.title,
    source: row.source,
    status: row.status,
    recruiterNotes: row.recruiterNotes,
    screeningNotes: row.screeningNotes,
    clientSubmissionDate: row.clientSubmissionDate ? row.clientSubmissionDate.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function normalizeCandidateEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function findCandidateByEmail(email: string): Promise<TalentCandidateRow | null> {
  const { db } = dbFromRequest();
  const rows = await db
    .select()
    .from(talentCandidates)
    .where(eq(talentCandidates.email, normalizeCandidateEmail(email)))
    .limit(1);
  return rows[0] ?? null;
}

function toMinor(rupees: number | undefined): number | null {
  if (rupees === undefined) return null;
  return Math.round(rupees * 100);
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: unknown }).code === '23505';
}

export function _appendTalentNote(existing: string | null, note: string): string {
  const cleaned = note.trim().slice(0, 2000);
  if (!existing) return cleaned;
  return `${existing}\n\n${cleaned}`.slice(0, 4000);
}

async function resolveOpenJob(jobUuid: string) {
  const { db } = dbFromRequest();
  const rows = await db.select().from(talentJobs).where(eq(talentJobs.id, jobUuid)).limit(1);
  const job = rows[0] ?? null;
  if (!job) throw new TalentNotFoundError('job');
  if (!isPubliclyListedJob(job.status)) throw new TalentJobNotOpenError();
  return job;
}


async function countOpenApplications(candidateUuid: string): Promise<number> {
  const { db } = dbFromRequest();
  const rows = await db
    .select({ status: talentApplications.status })
    .from(talentApplications)
    .where(eq(talentApplications.candidateId, candidateUuid));
  return rows.filter((row) => isActiveApplicationStatus(row.status)).length;
}

export interface PublicApplyArgs {
  jobUuid: string;
  input: TalentApplicationSubmission;
  resume: { filename: string; contentType: string | null; bytes: Buffer } | null;
}
async function storeResumeDoc(
  actorUserId: string | null,
  candidateUuid: string,
  applicationUuid: string | null,
  resume: { filename: string; contentType: string | null; bytes: Buffer },
): Promise<void> {
  const checked = validateResumeUpload(
    { filename: resume.filename, contentType: resume.contentType, byteSize: resume.bytes.byteLength },
    config.TALENT_MAX_RESUME_BYTES,
  );
  if (!checked.ok) throw new TalentInvalidDocumentError(checked.error);
  const head = new Uint8Array(resume.bytes.subarray(0, 8));
  if (!hasPlausibleSignature(head, checked.file.extension)) {
    throw new TalentInvalidDocumentError('The file does not look like a genuine PDF, DOC or DOCX document.');
  }
  const stored = await writeDocumentFile(checked.file.extension, resume.bytes);
  const { db } = dbFromRequest();
  await db.insert(talentDocuments).values({
    candidateId: candidateUuid,
    applicationId: applicationUuid,
    kind: 'resume',
    originalFilename: checked.file.filename,
    storageKey: stored.storageKey,
    mimeType: checked.file.mimeType,
    byteSize: stored.byteSize,
    checksumSha256: stored.checksumSha256,
    uploadedByUserId: actorUserId,
  });
  await recordTalentActivity(actorUserId, {
    entityType: 'document',
    entityId: candidateUuid,
    action: 'document_uploaded',
    summary: `Resume received: ${checked.file.filename}`,
    metadata: { byteSize: stored.byteSize },
  });
}

export async function applyToJobPublic(args: PublicApplyArgs): Promise<{
  candidateCode: string;
  applicationCode: string;
  duplicate: boolean;
}> {
  const job = await resolveOpenJob(args.jobUuid);
  const { db } = dbFromRequest();
  if (!args.input.consent) {
    throw new TalentValidationError('Please accept the recruitment-data consent to apply.');
  }
  const email = normalizeCandidateEmail(args.input.email);
  let candidate = await findCandidateByEmail(email);
  if (candidate) {
    const openCount = await countOpenApplications(candidate.id);
    if (openCount >= config.TALENT_MAX_OPEN_APPLICATIONS_PER_CANDIDATE) {
      throw new TalentApplicationLimitError('This email already has too many open applications.');
    }
    const dupe = await db.select().from(talentApplications)
      .where(and(eq(talentApplications.candidateId, candidate.id), eq(talentApplications.jobId, job.id))).limit(1);
    if (dupe[0]) {
      return { candidateCode: candidate.candidateId, applicationCode: dupe[0].applicationId, duplicate: true };
    }
  } else {
    const code = await nextCandidateId();
    const [row] = await db.insert(talentCandidates).values({
      candidateId: code,
      fullName: args.input.fullName,
      email,
      phone: args.input.phone ?? null,
      whatsapp: args.input.whatsapp ?? null,
      currentLocation: args.input.currentLocation ?? null,
      preferredLocation: args.input.preferredLocation ?? null,
      totalExperience: args.input.totalExperience ?? null,
      relevantExperience: args.input.relevantExperience ?? null,
      currentCompany: args.input.currentCompany ?? null,
      currentCtc: toMinor(args.input.currentCtc),
      expectedCtc: toMinor(args.input.expectedCtc),
      noticePeriod: args.input.noticePeriod ?? null,
      highestQualification: args.input.highestQualification ?? null,
      skills: args.input.skills ?? [],
      linkedinUrl: args.input.linkedinUrl ?? null,
      preferredWorkMode: args.input.preferredWorkMode ?? null,
      shiftPreference: args.input.shiftPreference ?? null,
      relocationPreference: args.input.relocationPreference ?? null,
      source: 'website',
      consentStatus: 'granted',
      consentAt: new Date(),
    }).returning();
    candidate = row;
    await recordTalentActivity(null, {
      entityType: 'candidate', entityId: candidate.id,
      action: 'candidate_created', summary: `Candidate via website: ${candidate.candidateId}`,
      metadata: { source: 'website' },
    });
  }
  const appCode = await nextApplicationId();
  let appRow: TalentApplicationRow;
  try {
    const [inserted] = await db.insert(talentApplications).values({
      applicationId: appCode, candidateId: candidate.id, jobId: job.id, source: 'website', status: 'NEW',
    }).returning();
    appRow = inserted;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const dupe = await db.select().from(talentApplications)
        .where(and(eq(talentApplications.candidateId, candidate.id), eq(talentApplications.jobId, job.id))).limit(1);
      if (dupe[0]) {
        return { candidateCode: candidate.candidateId, applicationCode: dupe[0].applicationId, duplicate: true };
      }
    }
    throw error;
  }
  if (args.resume) await storeResumeDoc(null, candidate.id, appRow.id, args.resume);
  await recordTalentActivity(null, {
    entityType: 'application', entityId: appRow.id,
    action: 'application_created', summary: `Application ${appRow.applicationId} for ${job.jobId}`,
    metadata: { jobId: job.id, candidateId: candidate.id },
  });
  return { candidateCode: candidate.candidateId, applicationCode: appRow.applicationId, duplicate: false };
}



export interface ListCandidatesOptions {
  query?: string;
  limit?: number;
}

export async function listCandidates(options: ListCandidatesOptions = {}): Promise<TalentCandidateDTO[]> {
  const { db } = dbFromRequest();
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
  const needle = (options.query ?? '').trim().toLowerCase();
  const rows = await db.select().from(talentCandidates).orderBy(desc(talentCandidates.createdAt)).limit(limit);
  return rows
    .filter((row) => {
      if (!needle) return row.archivedAt === null;
      const skills = readSkillList(row.skills).join(' ').toLowerCase();
      const hay = `${row.fullName} ${row.email} ${row.candidateId} ${skills}`.toLowerCase();
      return hay.includes(needle);
    })
    .map(toCandidateDTO);
}

export async function getCandidate(id: string): Promise<TalentCandidateDTO> {
  const { db } = dbFromRequest();
  const rows = await db.select().from(talentCandidates).where(eq(talentCandidates.id, id)).limit(1);
  const row = rows[0] ?? null;
  if (!row) throw new TalentNotFoundError('candidate');
  return toCandidateDTO(row);
}

/** Owner: creates a candidate manually (walk-in, referral, database import). */
export async function createCandidateManual(
  actorUserId: string | null,
  input: TalentCandidateInput,
): Promise<TalentCandidateDTO> {
  const { db } = dbFromRequest();
  const code = await nextCandidateId();
  const [row] = await db
    .insert(talentCandidates)
    .values({
      candidateId: code,
      fullName: input.fullName,
      email: normalizeCandidateEmail(input.email),
      phone: input.phone ?? null,
      whatsapp: input.whatsapp ?? null,
      currentLocation: input.currentLocation ?? null,
      preferredLocation: input.preferredLocation ?? null,
      totalExperience: input.totalExperience ?? null,
      relevantExperience: input.relevantExperience ?? null,
      currentCompany: input.currentCompany ?? null,
      currentCtc: toMinor(input.currentCtc),
      expectedCtc: toMinor(input.expectedCtc),
      noticePeriod: input.noticePeriod ?? null,
      highestQualification: input.highestQualification ?? null,
      skills: input.skills ?? [],
      linkedinUrl: input.linkedinUrl ?? null,
      preferredWorkMode: input.preferredWorkMode ?? null,
      shiftPreference: input.shiftPreference ?? null,
      relocationPreference: input.relocationPreference ?? null,
      source: input.source ?? 'owner_manual',
      consentStatus: 'granted',
      consentAt: new Date(),
      internalNotes: input.internalNotes ?? null,
    })
    .returning();
  await recordTalentActivity(actorUserId, {
    entityType: 'candidate',
    entityId: row.id,
    action: 'candidate_created',
    summary: `Candidate created by owner: ${row.candidateId}`,
    metadata: { source: row.source },
  });
  return toCandidateDTO(row);
}

/** Owner: updates the candidate's owner-only internal notes. */
export async function updateCandidateNotes(
  actorUserId: string | null,
  candidateUuid: string,
  internalNotes: string | null,
): Promise<TalentCandidateDTO> {
  const { db } = dbFromRequest();
  const rows = await db
    .update(talentCandidates)
    .set({ internalNotes, updatedAt: new Date() })
    .where(eq(talentCandidates.id, candidateUuid))
    .returning();
  const row = rows[0];
  if (!row) throw new TalentNotFoundError('candidate');
  await recordTalentActivity(actorUserId, {
    entityType: 'candidate',
    entityId: row.id,
    action: 'candidate_updated',
    summary: `Internal notes updated for ${row.candidateId}`,
  });
  return toCandidateDTO(row);
}

/** Owner: archives (soft-hides) a candidate. Never a hard delete. */
export async function archiveCandidate(
  actorUserId: string | null,
  candidateUuid: string,
): Promise<TalentCandidateDTO> {
  const { db } = dbFromRequest();
  const rows = await db
    .update(talentCandidates)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(talentCandidates.id, candidateUuid))
    .returning();
  const row = rows[0];
  if (!row) throw new TalentNotFoundError('candidate');
  await recordTalentActivity(actorUserId, {
    entityType: 'candidate',
    entityId: row.id,
    action: 'candidate_archived',
    summary: `Candidate archived: ${row.candidateId}`,
  });
  return toCandidateDTO(row);
}

/** Owner: records that the candidate was contacted (phone/WhatsApp/email). */
export async function markCandidateContacted(
  actorUserId: string | null,
  applicationUuid: string,
  channel: string,
): Promise<TalentApplicationDTO> {
  return transitionApplication(actorUserId, applicationUuid, 'CONTACTED', {
    note: `Candidate contacted via ${channel}`,
    activityAction: 'candidate_contacted',
  });
}

/** Owner: records that the candidate confirmed interest and details. */
export async function markCandidateConfirmed(
  actorUserId: string | null,
  applicationUuid: string,
): Promise<TalentApplicationDTO> {
  return transitionApplication(actorUserId, applicationUuid, 'INTERESTED', {
    note: 'Candidate confirmed interest and details',
    activityAction: 'candidate_confirmed',
  });
}

/** Owner: submits a candidate to the client (only from an allowed stage). */
export async function submitToClient(
  actorUserId: string | null,
  applicationUuid: string,
): Promise<TalentApplicationDTO> {
  return transitionApplication(actorUserId, applicationUuid, 'CLIENT_SUBMITTED', {
    activityAction: 'client_submission',
  });
}

async function getApplicationRow(applicationUuid: string): Promise<TalentApplicationRow> {
  const { db } = dbFromRequest();
  const rows = await db
    .select()
    .from(talentApplications)
    .where(eq(talentApplications.id, applicationUuid))
    .limit(1);
  const row = rows[0];
  if (!row) throw new TalentNotFoundError('application');
  return row;
}

/** Owner: full application with candidate + job context. */
export async function getApplication(applicationUuid: string): Promise<TalentApplicationDTO> {
  const row = await getApplicationRow(applicationUuid);
  return hydrateApplication(row);
}


export interface ListApplicationsOptions {
  jobUuid?: string;
  candidateUuid?: string;
  status?: string;
  limit?: number;
}

export async function listApplications(
  options: ListApplicationsOptions = {},
): Promise<TalentApplicationDTO[]> {
  const { db } = dbFromRequest();
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
  const filters = [];
  if (options.jobUuid) filters.push(eq(talentApplications.jobId, options.jobUuid));
  if (options.candidateUuid) filters.push(eq(talentApplications.candidateId, options.candidateUuid));
  if (options.status) filters.push(eq(talentApplications.status, options.status));
  const rows =
    filters.length > 0
      ? await db
          .select()
          .from(talentApplications)
          .where(and(...filters))
          .orderBy(desc(talentApplications.createdAt))
          .limit(limit)
      : await db.select().from(talentApplications).orderBy(desc(talentApplications.createdAt)).limit(limit);
  const result: TalentApplicationDTO[] = [];
  for (const row of rows) {
    result.push(await hydrateApplication(row));
  }
  return result;
}

/**
 * Moves an application through the pipeline. Transitions are validated against
 * the allowed map, and the confirmation gate (SHORTLISTED and later stages,
 * including CLIENT_SUBMITTED) turns on a real, persisted candidate-confirmation
 * record rather than a UI-state assumption — enforced here, not in the UI.
 */
export async function transitionApplication(
  actorUserId: string | null,
  applicationUuid: string,
  targetStatus: string,
  options: {
    note?: string;
    activityAction?:
      | 'candidate_contacted'
      | 'candidate_confirmed'
      | 'client_submission'
      | 'application_status_changed'
      | 'candidate_selected'
      | 'offer_received'
      | 'candidate_joined';
  } = {},
): Promise<TalentApplicationDTO> {
  const { db } = dbFromRequest();
  const current = await getApplicationRow(applicationUuid);
  if (!canTransitionApplication(current.status, targetStatus)) {
    throw new TalentInvalidTransitionError(current.status, targetStatus);
  }
  if (isConfirmationGateBlocked(current.status, targetStatus, current.candidateConfirmedAt)) {
    throw new TalentSubmissionBlockedError();
  }
  const patch: Partial<TalentApplicationRow> = { status: targetStatus, updatedAt: new Date() };
  if (options.note) {
    if (targetStatus === 'CONTACTED' || targetStatus === 'INTERESTED') {
      patch.screeningNotes = _appendTalentNote(current.screeningNotes, options.note);
    } else {
      patch.recruiterNotes = _appendTalentNote(current.recruiterNotes, options.note);
    }
  }
  if (targetStatus === 'INTERESTED') {
    patch.candidateConfirmedAt = new Date();
  }
  if (targetStatus === 'CLIENT_SUBMITTED') {
    patch.clientSubmissionDate = new Date();
  }
  const rows = await db
    .update(talentApplications)
    .set(patch)
    .where(eq(talentApplications.id, applicationUuid))
    .returning();
  const updated = rows[0];
  await recordTalentActivity(actorUserId, {
    entityType: 'application',
    entityId: updated.id,
    action: options.activityAction ?? 'application_status_changed',
    summary: `Application ${updated.applicationId}: ${current.status} -> ${targetStatus}`,
    metadata: { from: current.status, to: targetStatus },
  });
  return getApplication(updated.id);
}

/** Owner: attaches an existing candidate to a job (manual application row). */
export async function createManualApplication(
  actorUserId: string | null,
  input: TalentApplicationInput,
): Promise<TalentApplicationDTO> {
  const { db } = dbFromRequest();
  const candidateRows = await db
    .select()
    .from(talentCandidates)
    .where(eq(talentCandidates.id, input.candidateId))
    .limit(1);
  const candidate = candidateRows[0];
  if (!candidate) throw new TalentNotFoundError('candidate');
  const jobRows = await db.select().from(talentJobs).where(eq(talentJobs.id, input.jobId)).limit(1);
  const job = jobRows[0];
  if (!job) throw new TalentNotFoundError('job');
  try {
    const [row] = await db
      .insert(talentApplications)
      .values({
        applicationId: await nextApplicationId(),
        candidateId: candidate.id,
        jobId: job.id,
        source: input.source ?? 'owner_manual',
        status: 'NEW',
        recruiterNotes: input.recruiterNotes ?? null,
      })
      .returning();
    await recordTalentActivity(actorUserId, {
      entityType: 'application',
      entityId: row.id,
      action: 'application_created',
      summary: `Manual application ${row.applicationId} for ${job.jobId}`,
      metadata: { candidateId: candidate.id, jobId: job.id },
    });
    return toApplicationDTO(row, candidate, job);
  } catch (error) {
    if (isUniqueViolation(error)) throw new TalentDuplicateApplicationError();
    throw error;
  }
}

/** Owner: updates recruiter/screening notes on an application. */
export async function updateApplicationNotes(
  actorUserId: string | null,
  applicationUuid: string,
  notes: { recruiterNotes?: string | null; screeningNotes?: string | null },
): Promise<TalentApplicationDTO> {
  const { db } = dbFromRequest();
  const current = await getApplicationRow(applicationUuid);
  const rows = await db
    .update(talentApplications)
    .set({
      recruiterNotes:
        notes.recruiterNotes !== undefined ? notes.recruiterNotes : current.recruiterNotes,
      screeningNotes:
        notes.screeningNotes !== undefined ? notes.screeningNotes : current.screeningNotes,
      updatedAt: new Date(),
    })
    .where(eq(talentApplications.id, applicationUuid))
    .returning();
  const row = rows[0];
  if (!row) throw new TalentNotFoundError('application');
  await recordTalentActivity(actorUserId, {
    entityType: 'application',
    entityId: row.id,
    action: 'application_status_changed',
    summary: `Notes updated for application ${row.applicationId}`,
  });
  return getApplication(row.id);
}

/** Total open applications for the owner dashboard. */
export async function countOpenApplicationsTotal(): Promise<number> {
  const { db } = dbFromRequest();
  const rows = await db.select({ status: talentApplications.status }).from(talentApplications);
  return rows.filter((row) => isActiveApplicationStatus(row.status)).length;
}

/** Joins application row with candidate/job human identifiers. */
async function hydrateApplication(row: TalentApplicationRow): Promise<TalentApplicationDTO> {
  const { db } = dbFromRequest();
  const candidateRows = await db
    .select({ id: talentCandidates.id, candidateId: talentCandidates.candidateId })
    .from(talentCandidates)
    .where(eq(talentCandidates.id, row.candidateId))
    .limit(1);
  const jobRows = await db
    .select({ id: talentJobs.id, jobId: talentJobs.jobId, title: talentJobs.title })
    .from(talentJobs)
    .where(eq(talentJobs.id, row.jobId))
    .limit(1);
  return toApplicationDTO(
    row,
    candidateRows[0] ?? { id: row.candidateId, candidateId: 'unknown' },
    jobRows[0] ?? { id: row.jobId, jobId: 'unknown', title: 'Unknown role' },
  );
}

