import { NextRequest } from 'next/server';
import { handleApi, parseSearchParams, parseWithSchema, readJsonBody } from '@/lib/errors/api-handler';
import { requireOwner } from '@/lib/admin/guards';
import { withTalentErrors } from '@/lib/talent/api';
import { talentInterviewInputSchema, talentInterviewListQuerySchema } from '@/lib/talent/schemas';
import { listInterviews, scheduleInterview } from '@/lib/talent/interviews';

/**
 * GET /api/owner/talent/interviews — Owner-only interview list.
 * Optional `applicationId` (uuid) scopes the list to one application.
 */
export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      await requireOwner();
      const query = parseWithSchema(talentInterviewListQuerySchema, parseSearchParams(req));
      const interviews = await listInterviews({
        applicationId: query.applicationId,
        upcomingOnly: query.upcomingOnly,
        limit: query.limit,
      });
      return { interviews };
    })
  );
}

/** POST /api/owner/talent/interviews — Owner-only interview scheduling. */
export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      const actor = await requireOwner();
      const input = parseWithSchema(talentInterviewInputSchema, await readJsonBody(req));
      const interview = await scheduleInterview(actor.id, input);
      return { interview };
    }),
    () => 201
  );
}
