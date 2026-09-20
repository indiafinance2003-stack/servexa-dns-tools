import { NextRequest } from 'next/server';
import { handleApi, parseSearchParams, parseWithSchema, readJsonBody } from '@/lib/errors/api-handler';
import { requireOwner } from '@/lib/admin/guards';
import { withTalentErrors } from '@/lib/talent/api';
import { talentListQuerySchema, talentPlacementInputSchema } from '@/lib/talent/schemas';
import { createPlacement, listPlacements } from '@/lib/talent/placements';

/** GET /api/owner/talent/placements — Owner-only placement list. */
export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      await requireOwner();
      const query = parseWithSchema(talentListQuerySchema, parseSearchParams(req));
      const placements = await listPlacements({
        status: query.status,
        clientId: query.clientId,
        limit: query.limit,
      });
      return { placements };
    })
  );
}

/** POST /api/owner/talent/placements — Owner-only placement creation. */
export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      const actor = await requireOwner();
      const input = parseWithSchema(talentPlacementInputSchema, await readJsonBody(req));
      const placement = await createPlacement(actor.id, input);
      return { placement };
    }),
    () => 201
  );
}
