import {
  TALENT_APPLICATION_STATUSES,
  type TalentApplicationStatus,
  type TalentFeeType,
} from '@/lib/db/schema';

/**
 * Ravelyth Talent — pure business rules.
 *
 * No database, request or authentication imports: every rule here is a
 * deterministic function of its arguments so the security- and money-sensitive
 * behaviour (pipeline transitions, the no-automatic-client-submission rule,
 * placement fee calculation, resume validation) can be unit tested without a
 * live PostgreSQL instance.
 */

/**
 * Allowed application pipeline transitions.
 *
 * The workflow is deliberately stage-by-stage: an application can only reach
 * CLIENT_SUBMITTED through SHORTLISTED (i.e. after the Owner has contacted and
 * confirmed the candidate), which is what enforces "no automatic submission".
 */
export const TALENT_APPLICATION_TRANSITIONS: Record<
  TalentApplicationStatus,
  TalentApplicationStatus[]
> = {
  NEW: ['SCREENING', 'CONTACTED', 'REJECTED', 'NO_RESPONSE', 'WITHDRAWN', 'ON_HOLD'],
  SCREENING: ['CONTACTED', 'SHORTLISTED', 'REJECTED', 'NO_RESPONSE', 'WITHDRAWN', 'ON_HOLD'],
  CONTACTED: ['INTERESTED', 'SHORTLISTED', 'REJECTED', 'NO_RESPONSE', 'WITHDRAWN', 'ON_HOLD'],
  INTERESTED: ['SHORTLISTED', 'REJECTED', 'WITHDRAWN', 'NO_RESPONSE', 'ON_HOLD'],
  SHORTLISTED: ['CLIENT_SUBMITTED', 'REJECTED', 'WITHDRAWN', 'NO_RESPONSE', 'ON_HOLD'],
  CLIENT_SUBMITTED: ['INTERVIEW', 'REJECTED', 'WITHDRAWN', 'NO_RESPONSE', 'ON_HOLD'],
  INTERVIEW: ['SELECTED', 'REJECTED', 'WITHDRAWN', 'NO_RESPONSE', 'ON_HOLD'],
  SELECTED: ['OFFER', 'REJECTED', 'WITHDRAWN', 'ON_HOLD'],
  OFFER: ['JOINED', 'REJECTED', 'WITHDRAWN'],
  // Terminal stages: nothing further is expected, but a withdrawal is always
  // honoured because a candidate may change their mind at any point.
  JOINED: ['WITHDRAWN'],
  REJECTED: ['ON_HOLD', 'SCREENING'],
  WITHDRAWN: [],
  NO_RESPONSE: ['CONTACTED', 'SCREENING', 'ON_HOLD'],
  ON_HOLD: ['SCREENING', 'CONTACTED', 'REJECTED'],
};

export function canTransitionApplication(from: string, to: string): boolean {
  if (!(TALENT_APPLICATION_STATUSES as readonly string[]).includes(from)) return false;
  if (!(TALENT_APPLICATION_STATUSES as readonly string[]).includes(to)) return false;
  if (from === to) return false;
  return TALENT_APPLICATION_TRANSITIONS[from as TalentApplicationStatus].includes(
    to as TalentApplicationStatus
  );
}

/**
 * Statuses that may only be reached by an explicit Owner action after the
 * candidate has been contacted and has confirmed interest.
 *
 * This is the rule that prevents automated client submission: no code path
 * sets CLIENT_SUBMITTED as part of application intake.
 */
export const OWNER_CONFIRMED_STATUSES: TalentApplicationStatus[] = [
  'SHORTLISTED',
  'CLIENT_SUBMITTED',
  'INTERVIEW',
  'SELECTED',
  'OFFER',
  'JOINED',
];

export function requiresCandidateConfirmation(status: string): boolean {
  return (OWNER_CONFIRMED_STATUSES as readonly string[]).includes(status);
}

/** Whether a client submission is permitted for the current pipeline stage. */
export function canSubmitToClient(
  currentStatus: string,
  candidateConfirmedInterest: boolean
): boolean {
  if (currentStatus !== 'SHORTLISTED') return false;
  return candidateConfirmedInterest;
}

/**
 * Whether a transition to `targetStatus` is blocked because this application
 * has no persisted candidate confirmation yet.
 *
 * CLIENT_SUBMITTED always requires a confirmation, and the confirm-gated
 * pipeline stages (SHORTLISTED onward) can only be entered once confirmation
 * has been recorded. `candidateConfirmedAt` is server-side persisted state, so
 * an application that merely reached SHORTLISTED — including rows created
 * before the confirmation column existed — can never be submitted to a client.
 */
export function isConfirmationGateBlocked(
  currentStatus: string,
  targetStatus: string,
  candidateConfirmedAt: Date | null
): boolean {
  if (candidateConfirmedAt !== null) return false;
  if (targetStatus === 'CLIENT_SUBMITTED') return !canSubmitToClient(currentStatus, false);
  return requiresCandidateConfirmation(targetStatus);
}

/** Statuses counted as an active (in-progress) pipeline. */
export const ACTIVE_APPLICATION_STATUSES: TalentApplicationStatus[] = [
  'NEW',
  'SCREENING',
  'CONTACTED',
  'INTERESTED',
  'SHORTLISTED',
  'CLIENT_SUBMITTED',
  'INTERVIEW',
  'SELECTED',
  'OFFER',
];

export function isActiveApplicationStatus(status: string): boolean {
  return (ACTIVE_APPLICATION_STATUSES as readonly string[]).includes(status);
}
function isNonNegativeInteger(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/**
 * Placement fee calculation.
 *
 * Money is integer minor units (paise). `feePercentage` is stored in BASIS
 * POINTS (1 bp = 0.01%), so 8.33% is stored as 833 — this keeps the fee a
 * whole number of paise without ever using a floating-point money value.
 *
 * - percentage → annualCtc x bp / 10000
 * - fixed      → the fixed fee
 * - hybrid     → percentage component + fixed component
 *
 * Returns null when the inputs cannot produce a fee (for example a percentage
 * fee with no CTC recorded), so the UI shows "not calculated" instead of 0.
 */
export function calculatePlacementFee(input: {
  feeType: string;
  annualCtcMinor: number | null;
  feeBasisPoints: number | null;
  fixedFeeMinor: number | null;
}): number | null {
  const ctc = isNonNegativeInteger(input.annualCtcMinor) ? input.annualCtcMinor : null;
  const bp = isNonNegativeInteger(input.feeBasisPoints) ? input.feeBasisPoints : null;
  const fixed = isNonNegativeInteger(input.fixedFeeMinor) ? input.fixedFeeMinor : null;

  const percentageComponent = ctc !== null && bp !== null ? Math.round((ctc * bp) / 10_000) : null;

  switch (input.feeType as TalentFeeType) {
    case 'percentage':
      return percentageComponent;
    case 'fixed':
      return fixed;
    case 'hybrid':
      if (percentageComponent === null && fixed === null) return null;
      return (percentageComponent ?? 0) + (fixed ?? 0);
    default:
      return null;
  }
}

/** Formats basis points as a percentage string ("833" → "8.33%"). */
export function formatBasisPoints(bp: number | null): string | null {
  if (!isNonNegativeInteger(bp)) return null;
  return `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 2)}%`;
}

/** Converts a user-entered percentage (e.g. "8.33") to basis points. */
export function percentToBasisPoints(percent: number): number | null {
  if (typeof percent !== 'number' || !Number.isFinite(percent) || percent < 0) return null;
  return Math.round(percent * 100);
}

/** Replacement window end date, derived from the joining date. */
export function computeReplacementUntil(
  joiningDate: Date | null,
  replacementPeriodDays: number | null
): Date | null {
  if (!joiningDate) return null;
  if (!isNonNegativeInteger(replacementPeriodDays) || replacementPeriodDays === 0) return null;
  return new Date(joiningDate.getTime() + replacementPeriodDays * 24 * 60 * 60 * 1000);
}

/** A placement payment status that still represents money owed to Ravelyth. */
export function isOutstandingPayment(status: string): boolean {
  return (
    status === 'PENDING' ||
    status === 'INVOICED' ||
    status === 'PARTIALLY_PAID' ||
    status === 'OVERDUE'
  );
}

/** Whether a payment state counts as realised revenue. */
export function isRealisedPayment(status: string): boolean {
  return status === 'PAID';
}