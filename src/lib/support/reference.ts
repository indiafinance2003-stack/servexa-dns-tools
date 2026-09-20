import { randomBytes } from 'crypto';

/**
 * Support ticket references are human-quotable identifiers (RT-2026-XXXXXXXX).
 *
 * They are generated with a CSPRNG and are NOT secrets: the reference is
 * useless without an authenticated session, because every ticket lookup is
 * scoped to the signed-in customer. The database column is unique, so a
 * collision simply fails the insert instead of overwriting a ticket.
 */
export function generateTicketReference(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const suffix = randomBytes(4).toString('hex').toUpperCase();
  return `RT-${year}-${suffix}`;
}

/** Normalizes a user-supplied reference for display/lookup. */
export function normalizeTicketReference(reference: string): string {
  return reference.trim().toUpperCase();
}

const REFERENCE_PATTERN = /^RT-\d{4}-[0-9A-F]{8}$/;

export function isValidTicketReference(reference: string): boolean {
  return REFERENCE_PATTERN.test(normalizeTicketReference(reference));
}
