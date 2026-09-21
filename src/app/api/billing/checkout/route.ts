import { NextRequest } from 'next/server';
import { handleApi } from '@/lib/errors/api-handler';
import { requireApiUser } from '@/lib/auth/require-user';
import { AppError, AppErrorCode } from '@/lib/errors/app-error';
import { startManagedSupportCheckout } from '@/lib/billing/checkout';

export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => {
    const user = await requireApiUser();
    if (!user) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, 'Sign in to check out.', 401);
    }
    return startManagedSupportCheckout(user.id);
  }, () => 201);
}