import { NextRequest } from 'next/server';
import { handleApi, readJsonBody, parseSearchParams } from '@/lib/errors/api-handler';
import { parseWithSchema } from '@/lib/validation/parse';
import { requireOwner } from '@/lib/admin/guards';
import { withTalentErrors } from '@/lib/talent/api';
import { createCandidateManual, listCandidates } from '@/lib/talent/candidates';
import { talentCandidateInputSchema, talentListQuerySchema } from '@/lib/talent/schemas';

/**
 * GET /api/owner/talent/candidates — search/list candidates (Owner only).
 * Query: q (name/email/code search), limit. Archived candidates are excluded
 * from the default list; they remain reachable by direct id.
 */
export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      await requireOwner();
      const query = parseWithSchema(talentListQuerySchema, parseSearchParams(req));
      const candidates = await listCandidates({ query: query.q, limit: query.limit });
      return { candidates };
    })
  );
}

/** POST /api/owner/talent/candidates — create a candidate manually (Owner only). */
export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      const actor = await requireOwner();
      const body = await readJsonBody(req);
      const input = parseWithSchema(talentCandidateInputSchema, body);
      const candidate = await createCandidateManual(actor.id, input);
      return { candidate };
    }),
    () => 201
  );
}
