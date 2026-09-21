import { NextRequest } from 'next/server';
import { handleApi, readJsonBody } from '@/lib/errors/api-handler';
import { parseWithSchema } from '@/lib/validation/parse';
import { forgotPasswordSchema } from '@/lib/auth/schemas';
import { requestPasswordReset } from '@/lib/auth/password-reset';
import {
  checkAuthRateLimit,
  forgotPasswordClientKey,
  forgotPasswordKey,
  FORGOT_PASSWORD_WINDOW_MS,
  getForgotPasswordClientRateLimiter,
  getForgotPasswordRateLimiter,
} from '@/lib/auth/rate-limit';

/**
 * POST /api/auth/forgot-password
 *
 * Requests a password-reset link for an email address.
 *
 * The response is ALWAYS the same regardless of whether the account exists —
 * this endpoint must never be used to enumerate accounts. Rate limiting applies
 * both per email+client (so one account cannot be flooded) and per client (so
 * a single client cannot probe many addresses).
 */
const GENERIC_RESPONSE = 'If an account exists for that email, a password reset link will be sent.';

async function forgotPassword(req: NextRequest) {
  const body = await readJsonBody(req);
  const input = parseWithSchema(forgotPasswordSchema, body);

  checkAuthRateLimit(
    getForgotPasswordRateLimiter(),
    forgotPasswordKey(req, input.email),
    `Too many reset requests for this email. Try again in ${Math.ceil(
      FORGOT_PASSWORD_WINDOW_MS / 60000
    )} minutes.`
  );
  checkAuthRateLimit(
    getForgotPasswordClientRateLimiter(),
    forgotPasswordClientKey(req),
    'Too many reset requests from this device. Please try again later.'
  );

  await requestPasswordReset(input.email);

  // Generic for known and unknown emails alike.
  return { message: GENERIC_RESPONSE };
}

export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, () => forgotPassword(req));
}