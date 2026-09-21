import { NextRequest } from 'next/server';
import { handleApi, readJsonBody } from '@/lib/errors/api-handler';
import { parseWithSchema } from '@/lib/validation/parse';
import { resetPasswordSchema } from '@/lib/auth/schemas';
import { completePasswordReset } from '@/lib/auth/password-reset';

/**
 * POST /api/auth/reset-password
 *
 * Consumes a single-use reset token and replaces the account's password.
 *
 * Success invalidates every existing session for the user. On failure the
 * response is deliberately generic ("invalid or expired") and never reveals
 * whether the token existed, was used, or expired. The raw token is validated
 * server-side only and is never logged or stored in its raw form.
 */
async function resetPassword(req: NextRequest) {
  const body = await readJsonBody(req);
  const input = parseWithSchema(resetPasswordSchema, body);

  await completePasswordReset({ token: input.token, password: input.password });

  return { message: 'Your password has been reset. Please sign in with your new password.' };
}

export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, () => resetPassword(req));
}