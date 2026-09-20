import { NextRequest } from 'next/server';
import { handleApi, readJsonBody, parseSearchParams } from '@/lib/errors/api-handler';
import { parseWithSchema } from '@/lib/validation/parse';
import { requireOwner } from '@/lib/admin/guards';
import { withTalentErrors } from '@/lib/talent/api';
import { createManualApplication, listApplications } from '@/lib/talent/candidates';
import { talentApplicationInputSchema, talentListQuerySchema } from '@/lib/talent/schemas';

/**
 * GET /api/owner/talent/applications — list applications with optional filters
 * (jobId, candidateId, status). Owner only.
 */
export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      await requireOwner();
      const query = parseWithSchema(talentListQuerySchema, parseSearchParams(req));
      const applications = await listApplications({
        jobUuid: query.jobId,
        candidateUuid: query.candidateId,
        status: query.status,
        limit: query.limit,
      });
      return { applications };
    })
  );
}

/** POST /api/owner/talent/applications — attach an existing candidate to a job. */
export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      const actor = await requireOwner();
      const body = await readJsonBody(req);
      const input = parseWithSchema(talentApplicationInputSchema, body);
      const application = await createManualApplication(actor.id, input);
      return { application };
    }),
    () => 201
  );
}
