import { NextRequest } from 'next/server';
import { handleApi, readJsonBody } from '@/lib/errors/api-handler';
import { requireApiUser } from '@/lib/auth/require-user';
import { AppError, AppErrorCode } from '@/lib/errors/app-error';
import { verifyAndCompletePayment } from '@/lib/billing/checkout';

interface VerifyBody {
  checkoutSessionId?: unknown;
  providerPaymentId?: unknown;
  providerOrderId?: unknown;
  signature?: unknown;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(
      AppErrorCode.VALIDATION_ERROR,
      `${label} is required.`,
      400
    );
  }
  return value.trim();
}

export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => {
    const user = await requireApiUser();
    if (!user) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, 'Sign in to complete the payment.', 401);
    }

    const body = (await readJsonBody(req)) as VerifyBody;
    const checkoutSessionId = requireString(body.checkoutSessionId, 'checkoutSessionId');
    const confirmation = {
      providerPaymentId: requireString(body.providerPaymentId, 'providerPaymentId'),
      providerOrderId: requireString(body.providerOrderId, 'providerOrderId'),
      signature: requireString(body.signature, 'signature'),
    };

    return await verifyAndCompletePayment(user.id, checkoutSessionId, confirmation);
  });
}