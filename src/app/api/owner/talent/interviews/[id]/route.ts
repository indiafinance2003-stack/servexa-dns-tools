import { NextRequest } from 'next/server';
import { handleApi, parseWithSchema, readJsonBody } from '@/lib/errors/api-handler';
import { requireOwner } from '@/lib/admin/guards';
import { withTalentErrors } from '@/lib/talent/api';
import { talentInterviewUpdateSchema } from '@/lib/talent/schemas';
import { updateInterview } from '@/lib/talent/interviews';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** PATCH /api/owner/talent/interviews/[id] — reschedule / complete / feedback. */
export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      const actor = await requireOwner();
      const { id } = await ctx.params;
      const input = parseWithSchema(talentInterviewUpdateSchema, await readJsonBody(req));
      const interview = await updateInterview(actor.id, id, input);
      return { interview };
    })
  );
}
