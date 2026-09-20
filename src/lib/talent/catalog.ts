import {
  TALENT_APPLICATION_STATUSES,
  TALENT_CLIENT_STATUSES,
  TALENT_FEE_TYPES,
  TALENT_INTERVIEW_STATUSES,
  TALENT_JOB_STATUSES,
  TALENT_PAYMENT_STATUSES,
  type TalentApplicationStatus,
  type TalentClientStatus,
  type TalentFeeType,
  type TalentInterviewStatus,
  type TalentJobStatus,
  type TalentPaymentStatus,
} from '@/lib/db/schema';

/**
 * Ravelyth Talent — presentation-independent vocabulary.
 *
 * Stored values live in `src/lib/db/schema.ts` (single source of truth) and are
 * re-exported here alongside labels, ordering and the public-facing copy used by
 * the talent landing page, job listings and the Owner Room.
 *
 * The public copy in this module contains no candidate data, so it is safe to
 * import from an unauthenticated page.
 */

export {
  TALENT_APPLICATION_STATUSES,
  TALENT_CLIENT_STATUSES,
  TALENT_FEE_TYPES,
  TALENT_INTERVIEW_STATUSES,
  TALENT_JOB_STATUSES,
  TALENT_PAYMENT_STATUSES,
  type TalentApplicationStatus,
  type TalentClientStatus,
  type TalentFeeType,
  type TalentInterviewStatus,
  type TalentJobStatus,
  type TalentPaymentStatus,
};

/** Public recruitment contact address (role address, never a personal mailbox). */
export const TALENT_CONTACT_EMAIL = 'HR@ravelyth.in';

/** Focus areas advertised on the public talent landing page. */
export const TALENT_FOCUS_ROLES = [
  'Technical Support',
  'IT Support & Helpdesk',
  'Customer Support & Customer Success',
  'NOC Monitoring',
  'Linux / Server Support',
  'System Administration',
  'Application Support',
  'Junior QA',
  'IT Operations',
  'Inside Sales / BDE (technology companies)',
] as const;

/** Client segments Ravelyth Talent recruits for. */
export const TALENT_CLIENT_SEGMENTS = [
  'IT services companies',
  'SaaS product companies',
  'Hosting and managed service providers',
  'Technology startups',
  'Software product companies',
  'Support-heavy businesses',
] as const;

/** How Ravelyth Talent works, shown publicly without over-promising. */
export const TALENT_PUBLIC_PROCESS: Array<{ title: string; body: string }> = [
  {
    title: 'Role intake',
    body: 'We agree the requirement with the employer: role, location, work mode, experience band, shift, budget and interview process.',
  },
  {
    title: 'Sourcing and screening',
    body: 'Candidates are sourced, screened and contacted by us. Relevant experience, notice period and compensation expectations are verified before any submission.',
  },
  {
    title: 'Interview coordination',
    body: 'For shortlisted profiles we coordinate interview rounds, reminders and feedback collection with both sides.',
  },
  {
    title: 'Offer and joining',
    body: 'We support offer discussion, notice-period tracking and joining follow-ups until the candidate is on board.',
  },
  {
    title: 'Replacement support',
    body: 'Where the agreement includes a replacement window, we re-work the requirement if the candidate exits within that period.',
  },
];

/** What Ravelyth Talent does NOT do — stated publicly to avoid over-promising. */
export const TALENT_PUBLIC_BOUNDARIES = [
  'We do not guarantee an interview, a selection or a job offer for any applicant.',
  'We do not charge candidates any fee for applications, screening or placement.',
  'We do not submit a profile to an employer before speaking with the candidate and confirming interest.',
  'We do not make automated hiring decisions: every screening and submission is reviewed by a person.',
] as const;

export const TALENT_APPLICATION_STATUS_LABELS: Record<TalentApplicationStatus, string> = {
  NEW: 'New application',
  SCREENING: 'Screening',
  CONTACTED: 'Contacted',
  INTERESTED: 'Interested',
  SHORTLISTED: 'Shortlisted',
  CLIENT_SUBMITTED: 'Submitted to client',
  INTERVIEW: 'Interview stage',
  SELECTED: 'Selected',
  OFFER: 'Offer',
  JOINED: 'Joined',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
  NO_RESPONSE: 'No response',
  ON_HOLD: 'On hold',
};

export const TALENT_CLIENT_STATUS_LABELS: Record<TalentClientStatus, string> = {
  PROSPECT: 'Prospect',
  CONTACTED: 'Contacted',
  REPLIED: 'Replied',
  CALL_SCHEDULED: 'Call scheduled',
  REQUIREMENT_RECEIVED: 'Requirement received',
  ACTIVE_CLIENT: 'Active client',
  FUTURE: 'Future opportunity',
  NOT_INTERESTED: 'Not interested',
};

export const TALENT_JOB_STATUS_LABELS: Record<TalentJobStatus, string> = {
  DRAFT: 'Draft',
  OPEN: 'Open',
  PAUSED: 'Paused',
  CLOSED: 'Closed',
  FILLED: 'Filled',
  CANCELLED: 'Cancelled',
};

export const TALENT_INTERVIEW_STATUS_LABELS: Record<TalentInterviewStatus, string> = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  RESCHEDULED: 'Rescheduled',
  NO_SHOW: 'No show',
  CANCELLED: 'Cancelled',
  PASSED: 'Passed',
  FAILED: 'Failed',
};

export const TALENT_PAYMENT_STATUS_LABELS: Record<TalentPaymentStatus, string> = {
  PENDING: 'Pending',
  INVOICED: 'Invoiced',
  PARTIALLY_PAID: 'Partially paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
  WAIVED: 'Waived',
};

/** Pipeline column order used by the Owner Room dashboard. */
export const TALENT_PIPELINE_ORDER: TalentApplicationStatus[] = [
  'NEW',
  'SCREENING',
  'CONTACTED',
  'INTERESTED',
  'SHORTLISTED',
  'CLIENT_SUBMITTED',
  'INTERVIEW',
  'SELECTED',
  'OFFER',
  'JOINED',
];

/** Work modes offered on a job and selectable on an application. */
export const TALENT_WORK_MODES = ['onsite', 'hybrid', 'remote'] as const;
export type TalentWorkMode = (typeof TALENT_WORK_MODES)[number];

export const TALENT_WORK_MODE_LABELS: Record<TalentWorkMode, string> = {
  onsite: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
};

/** Employment types supported by the job form. */
export const TALENT_EMPLOYMENT_TYPES = [
  'full_time',
  'contract',
  'contract_to_hire',
  'internship',
  'part_time',
] as const;
export type TalentEmploymentType = (typeof TALENT_EMPLOYMENT_TYPES)[number];

export const TALENT_EMPLOYMENT_TYPE_LABELS: Record<TalentEmploymentType, string> = {
  full_time: 'Full time',
  contract: 'Contract',
  contract_to_hire: 'Contract to hire',
  internship: 'Internship',
  part_time: 'Part time',
};

/** Where a candidate or application came from. */
export const TALENT_SOURCES = [
  'website',
  'referral',
  'job_board',
  'linkedin',
  'agency',
  'internal_database',
  'owner_manual',
] as const;
export type TalentSource = (typeof TALENT_SOURCES)[number];

export const TALENT_SOURCE_LABELS: Record<TalentSource, string> = {
  website: 'Ravelyth website',
  referral: 'Referral',
  job_board: 'Job board',
  linkedin: 'LinkedIn',
  agency: 'Partner agency',
  internal_database: 'Internal database',
  owner_manual: 'Added by Ravelyth',
};

export function isTalentApplicationStatus(value: string): value is TalentApplicationStatus {
  return (TALENT_APPLICATION_STATUSES as readonly string[]).includes(value);
}

export function isTalentJobStatus(value: string): value is TalentJobStatus {
  return (TALENT_JOB_STATUSES as readonly string[]).includes(value);
}

export function isTalentClientStatus(value: string): value is TalentClientStatus {
  return (TALENT_CLIENT_STATUSES as readonly string[]).includes(value);
}

export function isTalentInterviewStatus(value: string): value is TalentInterviewStatus {
  return (TALENT_INTERVIEW_STATUSES as readonly string[]).includes(value);
}

export function isTalentPaymentStatus(value: string): value is TalentPaymentStatus {
  return (TALENT_PAYMENT_STATUSES as readonly string[]).includes(value);
}

export function isTalentWorkMode(value: string): value is TalentWorkMode {
  return (TALENT_WORK_MODES as readonly string[]).includes(value);
}

export function isTalentEmploymentType(value: string): value is TalentEmploymentType {
  return (TALENT_EMPLOYMENT_TYPES as readonly string[]).includes(value);
}

export function isTalentFeeType(value: string): value is TalentFeeType {
  return (TALENT_FEE_TYPES as readonly string[]).includes(value);
}

export function applicationStatusLabel(value: string): string {
  return isTalentApplicationStatus(value) ? TALENT_APPLICATION_STATUS_LABELS[value] : value;
}

export function jobStatusLabel(value: string): string {
  return isTalentJobStatus(value) ? TALENT_JOB_STATUS_LABELS[value] : value;
}

export function clientStatusLabel(value: string): string {
  return isTalentClientStatus(value) ? TALENT_CLIENT_STATUS_LABELS[value] : value;
}

export function interviewStatusLabel(value: string): string {
  return isTalentInterviewStatus(value) ? TALENT_INTERVIEW_STATUS_LABELS[value] : value;
}

export function paymentStatusLabel(value: string): string {
  return isTalentPaymentStatus(value) ? TALENT_PAYMENT_STATUS_LABELS[value] : value;
}

export function workModeLabel(value: string): string {
  return isTalentWorkMode(value) ? TALENT_WORK_MODE_LABELS[value] : value;
}

export function employmentTypeLabel(value: string): string {
  return isTalentEmploymentType(value) ? TALENT_EMPLOYMENT_TYPE_LABELS[value] : value;
}

export function sourceLabel(value: string): string {
  return (TALENT_SOURCES as readonly string[]).includes(value)
    ? TALENT_SOURCE_LABELS[value as TalentSource]
    : value;
}

/**
 * Whether a job is visible on the public `/talent/jobs` listing.
 *
 * Only OPEN jobs are public. Drafts, paused, closed, filled and cancelled jobs
 * remain visible to the Owner Room alone, so a withdrawn requirement can never
 * keep collecting applications.
 */
export function isPubliclyListedJob(status: string): boolean {
  return status === 'OPEN';
}