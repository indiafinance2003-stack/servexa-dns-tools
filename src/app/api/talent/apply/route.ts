import { NextRequest } from 'next/server';
import { AppError, AppErrorCode } from '@/lib/errors/app-error';
import { sendError, sendSuccess } from '@/lib/errors/api-handler';
import { parseWithSchema } from '@/lib/validation/parse';
import { config } from '@/lib/config';
import { applyToJobPublic } from '@/lib/talent/candidates';
import { resolvePublicJobUuid } from '@/lib/talent/public';
import { checkApplicationRateLimit, clientKeyOf, toAppError } from '@/lib/talent/api';
import { TalentInvalidDocumentError } from '@/lib/talent/errors';
import { talentApplicationSubmissionSchema } from '@/lib/talent/schemas';

/**
 * POST /api/talent/apply — the public (unauthenticated) candidate application.
 *
 * This is the only unauthenticated write path in Ravelyth and the single most
 * security-sensitive endpoint in the Talent vertical. The rules it enforces:
 *
 *  - Rate limited per client identity (`checkApplicationRateLimit`), on top of a
 *    hard body-size cap that accounts for the résumé plus form fields.
 *  - The job is resolved SERVER-SIDE from the human-readable code: the applicant
 *    can only name a job, never choose a job id, pipeline status, source or
 *    candidate identity. Those are all derived in the service layer.
 *  - Only an allow-listed set of form fields is read, and the payload still goes
 *    through the strict zod schema (`.strict()`), so injected keys cannot create
 *    extra database columns or unexpected behaviour.
 *  - The résumé is validated by extension, declared MIME type, size and magic
 *    bytes before anything is written to private storage.
 *
 * Responses contain only reference codes — never the stored candidate record.
 */

/** Upper bound for the whole multipart body: résumé plus a little form overhead. */
const MAX_MULTIPART_BYTES = config.TALENT_MAX_RESUME_BYTES + 128 * 1024;

const APPLY_FIELD_ALLOWLIST = [
  'fullName',
  'email',
  'phone',
  'whatsapp',
  'currentLocation',
  'preferredLocation',
  'totalExperience',
  'relevantExperience',
  'currentCompany',
  'highestQualification',
  'skills',
  'currentCtc',
  'expectedCtc',
  'noticePeriod',
  'preferredWorkMode',
  'shiftPreference',
  'relocationPreference',
  'linkedinUrl',
] as const;

const JOB_CODE_PATTERN = /^[A-Za-z0-9-]{3,32}$/;

async function handleApply(req: NextRequest): Promise<Response> {
  checkApplicationRateLimit(clientKeyOf(req.headers));

  const declaredLength = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) {
    throw new AppError(
      AppErrorCode.REQUEST_TOO_LARGE,
      'The application is too large. Please upload a résumé smaller than the stated limit.',
      413,
      { maxBytes: MAX_MULTIPART_BYTES }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new AppError(AppErrorCode.VALIDATION_ERROR, 'The form could not be read. Please try again.', 400);
  }

  // --- Job: named by code, resolved server-side to a real, OPEN job ---------
  const jobCode = String(form.get('jobId') ?? '').trim();
  if (!JOB_CODE_PATTERN.test(jobCode)) {
    throw new AppError(AppErrorCode.VALIDATION_ERROR, 'Select a position to apply for.', 400);
  }
  // Throws a 404-mapped talent error for unknown or non-public codes.
  const jobUuid = await resolvePublicJobUuid(jobCode);

  // --- Applicant fields: allow-listed, then strictly validated --------------
  const raw: Record<string, unknown> = {};
  for (const field of APPLY_FIELD_ALLOWLIST) {
    const value = form.get(field);
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    const required = field === 'fullName' || field === 'email' || field === 'phone';
    if (!required && trimmed.length === 0) continue;
    raw[field] = trimmed;
  }
  // Consent must arrive as an explicit positive value; anything else fails the
  // schema rather than being coerced.
  raw.consent = String(form.get('consent') ?? '').toLowerCase() === 'true';
  const input = parseWithSchema(talentApplicationSubmissionSchema, raw);

  // --- Résumé: required for a public application ---------------------------
  const upload = form.get('resume');
  if (!(upload instanceof File) || upload.size === 0) {
    throw new TalentInvalidDocumentError('Please attach your résumé as a PDF, DOC or DOCX file.');
  }
  if (upload.size > config.TALENT_MAX_RESUME_BYTES) {
    throw new TalentInvalidDocumentError(
      `The résumé must be smaller than ${Math.floor(config.TALENT_MAX_RESUME_BYTES / (1024 * 1024))} MB.`
    );
  }
  const bytes = Buffer.from(await upload.arrayBuffer());

  const result = await applyToJobPublic({
    jobUuid,
    input,
    resume: { filename: upload.name || 'resume', contentType: upload.type || null, bytes },
  });

  return sendSuccess(
    {
      candidateCode: result.candidateCode,
      applicationCode: result.applicationCode,
      duplicate: result.duplicate,
    },
    201
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    return await handleApply(req);
  } catch (error) {
    const mapped = error instanceof AppError ? error : toAppError(error);
    if (mapped instanceof AppError) return sendError(mapped);
    return sendError(new Error('The application could not be submitted. Please try again.'));
  }
}
