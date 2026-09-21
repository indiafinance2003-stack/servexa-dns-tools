import { NextRequest } from 'next/server';
import { handleApi, readJsonBody } from '@/lib/errors/api-handler';
import { requireApiUser } from '@/lib/auth/require-user';
import { AppError, AppErrorCode } from '@/lib/errors/app-error';
import { listMyFeedback, submitFeedback } from '@/lib/feedback/service';

export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => {
    const user = await requireApiUser();
    if (!user) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, 'Sign in to view your feedback.', 401);
    }
    return listMyFeedback(user.id);
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => {
    const user = await requireApiUser();
    if (!user) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, 'Sign in to submit feedback.', 401);
    }
    const body = await readJsonBody(req);
    const feedback = await submitFeedback(user.id, {
      rating: body.rating,
      category: body.category,
      message: body.message,
    });
    return feedback;
  }, () => 201);
}