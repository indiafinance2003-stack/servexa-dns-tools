import { NextRequest } from 'next/server';
import { handleApi, readJsonBody } from '@/lib/errors/api-handler';
import { requireApiUser } from '@/lib/auth/require-user';
import { AppError, AppErrorCode } from '@/lib/errors/app-error';
import { markCheckoutSessionFailed } from '@/lib/billing/checkout';

/**
 * Explicitly cancels the user's pending checkout (used when the customer
 * closes/abandons the payment form). Keeps pending sessions tidy so the start
 * of a new purchase always begins fresh. A paid session is never cancelled.
 */
export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => {
    const user = await requireApiUser();
    if (!user) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, 'Sign in to manage checkout.', 401);
    }
    const body = (await readJsonBody(req)) as { checkoutSessionId?: unknown };
    const checkoutSessionId =
      typeof body.checkoutSessionId === 'string' && body.checkoutSessionId.trim()
        ? body.checkoutSessionId.trim()
        : null;
    if (!checkoutSessionId) {
      throw new AppError(
        AppErrorCode.VALIDATION_ERROR,
        'checkoutSessionId is required.',
        400
      );
    }
    await markCheckoutSessionFailed(user.id, checkoutSessionId, 'cancelled');
    return { cancelled: true };
  });
}