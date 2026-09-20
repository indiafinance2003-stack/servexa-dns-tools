import { NextRequest } from 'next/server';
import {
  handleApi,
  parseSearchParams,
  parseWithSchema,
  readJsonBody,
} from '@/lib/errors/api-handler';
import { requireOwner } from '@/lib/admin/guards';
import { withTalentErrors } from '@/lib/talent/api';
import { talentJobInputSchema, talentListQuerySchema } from '@/lib/talent/schemas';
import { createTalentJob, listTalentJobs } from '@/lib/talent/jobs';

/** GET /api/owner/talent/jobs — Owner-only job list (all statuses). */
export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      await requireOwner();
      const query = parseWithSchema(talentListQuerySchema, parseSearchParams(req));
      const jobs = await listTalentJobs({
        query: query.q,
        status: query.status,
        clientId: query.clientId,
        limit: query.limit,
      });
      return { jobs };
    })
  );
}

/** POST /api/owner/talent/jobs — Owner-only job creation (starts as DRAFT). */
export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      const actor = await requireOwner();
      const input = parseWithSchema(talentJobInputSchema, await readJsonBody(req));
      const job = await createTalentJob(actor.id, input);
      return { job };
    }),
    () => 201
  );
}
