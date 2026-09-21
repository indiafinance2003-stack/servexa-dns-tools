import { eq } from 'drizzle-orm';
import { dbFromRequest } from '@/lib/db/request';
import {
  contactSubmissions,
  CONTACT_SUBMISSION_STATUSES,
  type ContactSubmissionRow,
  type ContactSubmissionStatus,
} from '@/lib/db/schema';
import { AppError, AppErrorCode, ValidationError } from '@/lib/errors/app-error';

/**
 * Public contact submissions.
 *
 * The endpoint is unauthenticated, so abuse controls live at the API boundary:
 * strict rate limiting, a honeypot field, bounded input, and a one-way SHA-256
 * fingerprint of the client IP (never the raw address) to support spam review.
 */

export interface ContactSubmissionDTO {
  id: string;
  email: string;
  name: string;
  subject: string;
  message: string;
  status: string;
  statusLabel: string;
  ipFingerprint: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CONTACT_STATUS_LABELS: Record<ContactSubmissionStatus, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  actioned: 'Actioned',
  spam: 'Spam',
};

export function contactStatusLabel(status: string): string {
  return (CONTACT_SUBMISSION_STATUSES as readonly string[]).includes(status)
    ? CONTACT_STATUS_LABELS[status as ContactSubmissionStatus]
    : status;
}

const MAX_EMAIL = 254;
const MAX_NAME = 100;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 8000;

function toDTO(row: ContactSubmissionRow): ContactSubmissionDTO {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    subject: row.subject,
    message: row.message,
    status: row.status,
    statusLabel: contactStatusLabel(row.status),
    ipFingerprint: row.ipFingerprint,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface SubmitContactInput {
  name: unknown;
  email: unknown;
  subject: unknown;
  message: unknown;
  ipFingerprint?: string | null;
}

export interface NormalizedContactInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/**
 * Pure validation for a contact submission: trims input, normalizes the email,
 * and enforces the public bounce/abuse bounds. Exposed separately so the rules
 * are unit tested without a database.
 */
export function normalizeContactInput(input: SubmitContactInput): NormalizedContactInput {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const subject = typeof input.subject === 'string' ? input.subject.trim() : '';
  const message = typeof input.message === 'string' ? input.message.trim() : '';

  if (name.length === 0 || name.length > MAX_NAME) {
    throw new ValidationError(
      name.length === 0 ? 'Your name is required.' : `Your name is limited to ${MAX_NAME} characters.`
    );
  }
  if (email.length === 0 || email.length > MAX_EMAIL || !email.includes('@')) {
    throw new ValidationError('A valid email address is required.');
  }
  if (subject.length === 0 || subject.length > MAX_SUBJECT) {
    throw new ValidationError(
      subject.length === 0
        ? 'A short subject is required.'
        : `The subject is limited to ${MAX_SUBJECT} characters.`
    );
  }
  if (message.length === 0 || message.length > MAX_MESSAGE) {
    throw new ValidationError(
      message.length === 0
        ? 'A message is required.'
        : `The message is limited to ${MAX_MESSAGE} characters.`
    );
  }

  return { name, email, subject, message };
}

/**
 * Persists a contact submission after validation. Returns null for honeypot
 * hits so the route can acknowledge the bot politely without storing anything.
 */
export async function submitContact(input: SubmitContactInput): Promise<ContactSubmissionDTO> {
  const normalized = normalizeContactInput(input);

  const { db } = dbFromRequest();
  const [row] = await db
    .insert(contactSubmissions)
    .values({
      name: normalized.name,
      email: normalized.email,
      subject: normalized.subject,
      message: normalized.message,
      ipFingerprint: input.ipFingerprint,
    })
    .returning();

  return toDTO(row);
}

/** Owner listing: newest first. */
export async function listAllContactSubmissions(
  filters: { status?: string; limit?: number } = {}
): Promise<ContactSubmissionDTO[]> {
  const { db } = dbFromRequest();
  const limit = Math.min(Math.max((filters.limit ?? 50) | 0, 1), 200);

  const base = db.select().from(contactSubmissions);
  const rows =
    filters.status && (CONTACT_SUBMISSION_STATUSES as readonly string[]).includes(filters.status)
      ? await base.where(eq(contactSubmissions.status, filters.status as ContactSubmissionStatus))
      : await base;

  const ordered = rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  return ordered.map(toDTO);
}

/** Owner triage: reviewed / actioned / spam. */
export async function setContactSubmissionStatus(
  actorUserId: string,
  submissionId: string,
  status: ContactSubmissionStatus
): Promise<ContactSubmissionDTO> {
  if (!(CONTACT_SUBMISSION_STATUSES as readonly string[]).includes(status as ContactSubmissionStatus)) {
    throw new AppError(AppErrorCode.VALIDATION_ERROR, 'Unknown contact status.', 400);
  }

  const { db } = dbFromRequest();
  const rows = await db
    .select()
    .from(contactSubmissions)
    .where(eq(contactSubmissions.id, submissionId))
    .limit(1);
  if (!rows[0]) {
    throw new AppError(AppErrorCode.NOT_FOUND, 'Contact submission not found.', 404);
  }

  const [row] = await db
    .update(contactSubmissions)
    .set({ status, handledByUserId: actorUserId, updatedAt: new Date() })
    .where(eq(contactSubmissions.id, submissionId))
    .returning();

  return toDTO(row);
}

/** Validates a contact status string against the known set. */
export function isContactStatus(value: unknown): value is ContactSubmissionStatus {
  return (
    typeof value === 'string' &&
    (CONTACT_SUBMISSION_STATUSES as readonly string[]).includes(value)
  );
}

/** Session-independent nickname for honest owner review of unknown contacts. */
export function redactContactEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.charAt(0)}${'•'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
}