import { NextRequest } from 'next/server';
import { handleApi, parseWithSchema, readJsonBody } from '@/lib/errors/api-handler';
import { requireOwner } from '@/lib/admin/guards';
import { withTalentErrors } from '@/lib/talent/api';
import { talentJobInputSchema, talentJobStatusSchema } from '@/lib/talent/schemas';
import { getTalentJob, updateTalentJob, updateTalentJobStatus } from '@/lib/talent/jobs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/owner/talent/jobs/[id] — Owner-only job detail. */
export async function GET(req: NextRequest, ctx: RouteContext): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      await requireOwner();
      const { id } = await ctx.params;
      const job = await getTalentJob(id);
      return { job };
    })
  );
}

/**
 * PATCH /api/owner/talent/jobs/[id]
 * Either a status change (`{ status }`) or a content edit (full input).
 * The body shape decides which service path runs; both are Owner-only.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      const actor = await requireOwner();
      const { id } = await ctx.params;
      const body = await readJsonBody(req);
      if ('status' in body && Object.keys(body).length === 1) {
        const { status } = parseWithSchema(talentJobStatusSchema, body);
        const job = await updateTalentJobStatus(actor.id, id, status);
        return { job };
      }
      const input = parseWithSchema(talentJobInputSchema, body);
      const job = await updateTalentJob(actor.id, id, input);
      return { job };
    })
  );
}
