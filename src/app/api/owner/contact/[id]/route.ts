import { NextRequest } from 'next/server';
import { handleApi, readJsonBody } from '@/lib/errors/api-handler';
import { AppError, AppErrorCode } from '@/lib/errors/app-error';
import { requireOwner } from '@/lib/admin/guards';
import {
  isContactStatus,
  setContactSubmissionStatus,
} from '@/lib/contact/service';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** PATCH /api/owner/contact/[id] — Owner-only triage (reviewed/actioned/spam). */
export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  return handleApi(req, async () => {
    const actor = await requireOwner();
    const { id } = await ctx.params;
    const body = await readJsonBody(req);
    const status = body.status;
    if (!isContactStatus(status)) {
      throw new AppError(AppErrorCode.VALIDATION_ERROR, 'Unknown contact status.', 400);
    }
    return setContactSubmissionStatus(actor.id, id, status);
  });
}