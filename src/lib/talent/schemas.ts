import { z } from 'zod';
import {
  TALENT_APPLICATION_STATUSES,
  TALENT_CLIENT_STATUSES,
  TALENT_CONSENT_STATUSES,
  TALENT_FEE_TYPES,
  TALENT_INTERVIEW_STATUSES,
  TALENT_JOB_STATUSES,
  TALENT_PAYMENT_STATUSES,
} from '@/lib/db/schema';
import {
  TALENT_EMPLOYMENT_TYPES,
  TALENT_SOURCES,
  TALENT_WORK_MODES,
} from './catalog';

/**
 * Ravelyth Talent input schemas.
 *
 * Note what is deliberately ABSENT from the public application schema: there is
 * no `status`, no `jobId`, no `source` and no candidate id. The job comes from
 * the route, the pipeline status is always 'NEW', the source is 'website' and
 * the candidate identity is created server-side. A client can therefore never
 * place itself into a later pipeline stage or attach itself to a different job.
 */

/** Blank form fields arrive as '' — normalize them to undefined. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

/** Accepts a number or a numeric string and normalizes to an integer. */
const optionalInt = (min: number, max: number) =>
  z
    .union([z.number(), z.string()])
    .optional()
    .transform((value) => {
      if (value === undefined || value === null || value === '') return undefined;
      const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    })
    .refine((value) => value === undefined || (Number.isInteger(value) && value >= min && value <= max), {
      message: `Enter a whole number between ${min} and ${max}`,
    });

const requiredInt = (min: number, max: number) =>
  z
    .union([z.number(), z.string()])
    .transform((value) => {
      const parsed = typeof value === 'number' ? value : Number.parseInt(value, 10);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    })
    .refine((value) => Number.isInteger(value) && value >= min && value <= max, {
      message: `Enter a whole number between ${min} and ${max}`,
    });

/** Optional http(s) URL. */
const optionalUrl = (max = 300) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined))
    .refine(
      (value) => value === undefined || /^https?:\/\/[^\s<>"']+$/i.test(value),
      { message: 'Enter a full URL starting with http:// or https://' }
    );

/** Phone numbers are stored as entered but constrained to dial characters. */
const optionalPhone = z
  .string()
  .trim()
  .max(24)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .refine((value) => value === undefined || /^\+?[0-9 ()\-]{7,24}$/.test(value), {
    message: 'Enter a valid contact number',
  });

const requiredPhone = z
  .string()
  .trim()
  .min(7, 'Enter a valid contact number')
  .max(24)
  .refine((value) => /^\+?[0-9 ()\-]{7,24}$/.test(value), {
    message: 'Enter a valid contact number',
  });

/** Comma-separated skill list → trimmed, de-duplicated array. */
const skillList = z
  .string()
  .trim()
  .max(600)
  .optional()
  .transform((value) => {
    if (!value) return [] as string[];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of value.split(',')) {
      const skill = raw.trim().replace(/\s+/g, ' ').slice(0, 60);
      if (skill.length === 0) continue;
      const key = skill.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(skill);
      if (result.length >= 40) break;
    }
    return result;
  });

/**
 * ISO date input (yyyy-mm-dd from a date field) → Date.
 */
const optionalDate = z
  .string()
  .trim()
  .max(40)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined))
  .refine((value) => value === undefined || !Number.isNaN(new Date(value).getTime()), {
    message: 'Enter a valid date',
  });

/** ---------------------------------------------------------------------------
 * Clients
 * --------------------------------------------------------------------------- */

export const talentClientInputSchema = z
  .object({
    companyName: z
      .string()
      .trim()
      .min(2, 'Enter the company name')
      .max(200, 'Company name must be at most 200 characters'),
    companyWebsite: optionalUrl(),
    industry: optionalText(120),
    companyLocation: optionalText(160),
    companySize: optionalText(60),
    contactName: optionalText(120),
    contactDesignation: optionalText(120),
    contactEmail: z
      .union([z.string().trim().email('Enter a valid email address'), z.literal('')])
      .optional()
      .transform((value) => (value && value.length > 0 ? value.toLowerCase() : undefined)),
    contactPhone: optionalPhone,
    linkedinUrl: optionalUrl(),
    status: z.enum(TALENT_CLIENT_STATUSES).optional(),
    notes: optionalText(4000),
  })
  .strict();

export type TalentClientInput = z.infer<typeof talentClientInputSchema>;

/** ---------------------------------------------------------------------------
 * Jobs
 * --------------------------------------------------------------------------- */

export const talentJobInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Enter the job title')
      .max(160, 'Job title must be at most 160 characters'),
    clientId: z
      .string()
      .uuid('Select a client')
      .optional()
      .or(z.literal(''))
      .transform((value) => (value && value.length > 0 ? value : undefined)),
    description: z
      .string()
      .trim()
      .min(30, 'Add a job description of at least 30 characters')
      .max(20000, 'Job description must be at most 20000 characters'),
    employmentType: z.enum(TALENT_EMPLOYMENT_TYPES).default('full_time'),
    location: optionalText(160),
    workMode: z.enum(TALENT_WORK_MODES).default('onsite'),
    experienceMin: optionalInt(0, 60),
    experienceMax: optionalInt(0, 60),
    /** Annual salary in whole rupees — stored as integer minor units. */
    salaryMin: optionalInt(0, 100_000_000),
    salaryMax: optionalInt(0, 100_000_000),
    salaryCurrency: z.string().trim().length(3).toUpperCase().default('INR'),
    salaryPublic: z.boolean().default(false),
    openings: requiredInt(1, 999),
    requiredSkills: skillList,
    preferredSkills: skillList,
    qualification: optionalText(200),
    shift: optionalText(120),
    noticePeriodRequirement: optionalText(120),
  })
  .strict()
  .refine(
    (value) =>
      value.experienceMin === undefined ||
      value.experienceMax === undefined ||
      value.experienceMax >= value.experienceMin,
    {
      message: 'Maximum experience must be greater than or equal to the minimum',
      path: ['experienceMax'],
    }
  )
  .refine(
    (value) =>
      value.salaryMin === undefined ||
      value.salaryMax === undefined ||
      value.salaryMax >= value.salaryMin,
    { message: 'Maximum salary must be greater than or equal to the minimum', path: ['salaryMax'] }
  );

export type TalentJobInput = z.infer<typeof talentJobInputSchema>;

export const talentJobStatusSchema = z.object({ status: z.enum(TALENT_JOB_STATUSES) }).strict();

/** ---------------------------------------------------------------------------
 * Public application (unauthenticated)
 * --------------------------------------------------------------------------- */

export const talentApplicationSubmissionSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, 'Enter your full name')
      .max(120, 'Name must be at most 120 characters'),
    email: z.string().trim().email('Enter a valid email address').max(200).toLowerCase(),
    phone: requiredPhone,
    whatsapp: optionalPhone,
    currentLocation: optionalText(120),
    preferredLocation: optionalText(120),
    totalExperience: optionalInt(0, 60),
    relevantExperience: optionalInt(0, 60),
    currentCompany: optionalText(160),
    highestQualification: optionalText(160),
    skills: skillList,
    currentCtc: optionalInt(0, 100_000_000),
    expectedCtc: optionalInt(0, 100_000_000),
    noticePeriod: optionalText(60),
    preferredWorkMode: z.enum(TALENT_WORK_MODES).optional(),
    shiftPreference: optionalText(120),
    relocationPreference: optionalText(120),
    linkedinUrl: optionalUrl(),
    // Consent is mandatory and explicit; a missing value fails validation rather
    // than defaulting to true.
    consent: z.literal(true, {
      errorMap: () => ({
        message: 'Please confirm consent to store your details for recruitment purposes.',
      }),
    }),
  })
  .strict();

export type TalentApplicationSubmission = z.infer<typeof talentApplicationSubmissionSchema>;

/** ---------------------------------------------------------------------------
 * Owner-side candidate and application management
 * --------------------------------------------------------------------------- */

export const talentCandidateInputSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter the candidate name').max(120),
    email: z.string().trim().email('Enter a valid email address').max(200).toLowerCase(),
    phone: optionalPhone,
    whatsapp: optionalPhone,
    currentLocation: optionalText(120),
    preferredLocation: optionalText(120),
    totalExperience: optionalInt(0, 60),
    relevantExperience: optionalInt(0, 60),
    currentCompany: optionalText(160),
    highestQualification: optionalText(160),
    skills: skillList,
    currentCtc: optionalInt(0, 100_000_000),
    expectedCtc: optionalInt(0, 100_000_000),
    noticePeriod: optionalText(60),
    preferredWorkMode: z.enum(TALENT_WORK_MODES).optional(),
    shiftPreference: optionalText(120),
    relocationPreference: optionalText(120),
    linkedinUrl: optionalUrl(),
    source: z.enum(TALENT_SOURCES).default('owner_manual'),
    consentStatus: z.enum(TALENT_CONSENT_STATUSES).default('granted'),
    internalNotes: optionalText(4000),
  })
  .strict();

export type TalentCandidateInput = z.infer<typeof talentCandidateInputSchema>;

export const talentApplicationInputSchema = z
  .object({
    candidateId: z.string().uuid('Select a candidate'),
    jobId: z.string().uuid('Select a job'),
    source: z.enum(TALENT_SOURCES).default('owner_manual'),
    recruiterNotes: optionalText(4000),
  })
  .strict();

export type TalentApplicationInput = z.infer<typeof talentApplicationInputSchema>;

export const talentApplicationStatusSchema = z
  .object({
    status: z.enum(TALENT_APPLICATION_STATUSES),
    note: optionalText(2000),
  })
  .strict();

export const talentApplicationNotesSchema = z
  .object({
    recruiterNotes: optionalText(4000),
    screeningNotes: optionalText(4000),
  })
  .strict();

/** ---------------------------------------------------------------------------
 * Interviews
 * --------------------------------------------------------------------------- */

export const talentInterviewInputSchema = z
  .object({
    applicationId: z.string().uuid('Select an application'),
    round: z
      .string()
      .trim()
      .min(1, 'Name the interview round')
      .max(80, 'Round name must be at most 80 characters'),
    scheduledAt: optionalDate,
    interviewType: z.enum(['video', 'phone', 'in_person', 'technical', 'hr']).default('video'),
    meetingLink: optionalUrl(500),
    interviewer: optionalText(160),
    status: z.enum(TALENT_INTERVIEW_STATUSES).default('SCHEDULED'),
    feedback: optionalText(4000),
  })
  .strict();

export type TalentInterviewInput = z.infer<typeof talentInterviewInputSchema>;

export const talentInterviewUpdateSchema = z
  .object({
    scheduledAt: optionalDate,
    interviewType: z.enum(['video', 'phone', 'in_person', 'technical', 'hr']).optional(),
    meetingLink: optionalUrl(500),
    interviewer: optionalText(160),
    status: z.enum(TALENT_INTERVIEW_STATUSES).optional(),
    feedback: optionalText(4000),
  })
  .strict();

/** ---------------------------------------------------------------------------
 * Placements
 * --------------------------------------------------------------------------- */

export const talentPlacementInputSchema = z
  .object({
    applicationId: z.string().uuid('Select an application'),
    /** Annual CTC in whole rupees — stored as integer minor units. */
    annualCtc: optionalInt(0, 100_000_000),
    feeType: z.enum(TALENT_FEE_TYPES).default('percentage'),
    /** Percentage entered by a human (8.33). Converted to basis points on save. */
    feePercentage: z
      .union([z.number(), z.string()])
      .optional()
      .transform((value) => {
        if (value === undefined || value === null || value === '') return undefined;
        const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : undefined;
      })
      .refine((value) => value === undefined || (value >= 0 && value <= 100), {
        message: 'Enter a fee percentage between 0 and 100',
      }),
    fixedFee: optionalInt(0, 100_000_000),
    placementDate: optionalDate,
    joiningDate: optionalDate,
    paymentStatus: z.enum(TALENT_PAYMENT_STATUSES).default('PENDING'),
    paymentDueDate: optionalDate,
    replacementPeriodDays: optionalInt(0, 730),
    notes: optionalText(4000),
  })
  .strict()
  .refine(
    (value) =>
      value.feeType !== 'percentage' ||
      value.feePercentage !== undefined ||
      value.annualCtc !== undefined,
    { message: 'A percentage fee needs a fee percentage and an annual CTC', path: ['feePercentage'] }
  );

export type TalentPlacementInput = z.infer<typeof talentPlacementInputSchema>;

export const talentPaymentStatusSchema = z
  .object({ paymentStatus: z.enum(TALENT_PAYMENT_STATUSES) })
  .strict();

/** ---------------------------------------------------------------------------
 * Filters and pagination
 * --------------------------------------------------------------------------- */

export const talentListQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    status: z.string().trim().max(40).optional(),
    clientId: z.string().uuid().optional(),
    jobId: z.string().uuid().optional(),
    candidateId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    page: z.coerce.number().int().min(1).max(1000).optional(),
  })
  .strict();

export type TalentListQuery = z.infer<typeof talentListQuerySchema>;

/**
 * Interview list filters. Interviews hang off an application, so the only
 * meaningful scope is one application (uuid) plus an optional row cap.
 */
export const talentInterviewListQuerySchema = z
  .object({
    applicationId: z.string().uuid().optional(),
    upcomingOnly: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => value === 'true'),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export type TalentInterviewListQuery = z.infer<typeof talentInterviewListQuerySchema>;

/** Public job listing filters (subset of the above; no client or candidate ids). */
export const talentPublicJobQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    location: z.string().trim().max(120).optional(),
    workMode: z.string().trim().max(20).optional(),
    category: z.string().trim().max(60).optional(),
    minExperience: z.coerce.number().int().min(0).max(60).optional(),
    maxExperience: z.coerce.number().int().min(0).max(60).optional(),
  })
  .strict();

export type TalentPublicJobQuery = z.infer<typeof talentPublicJobQuerySchema>;