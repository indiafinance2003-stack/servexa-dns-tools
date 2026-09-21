import { NextRequest } from 'next/server';
import { handleApi, readJsonBody } from '@/lib/errors/api-handler';
import { AppError, AppErrorCode } from '@/lib/errors/app-error';
import { requireOwner } from '@/lib/admin/guards';
import {
  isFeedbackStatus,
  setFeedbackStatus,
} from '@/lib/feedback/service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** PATCH /api/owner/feedback/[id] — Owner-only triage (acknowledged/addressed). */
export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  return handleApi(req, async () => {
    const actor = await requireOwner();
    const { id } = await ctx.params;
    const body = await readJsonBody(req);
    const status = body.status;
    if (!isFeedbackStatus(status)) {
      throw new AppError(AppErrorCode.VALIDATION_ERROR, 'Unknown feedback status.', 400);
    }
    return setFeedbackStatus(actor.id, id, status);
  });
}