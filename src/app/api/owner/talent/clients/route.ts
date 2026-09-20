import { NextRequest } from 'next/server';
import {
  handleApi,
  parseSearchParams,
  parseWithSchema,
  readJsonBody,
} from '@/lib/errors/api-handler';
import { requireOwner } from '@/lib/admin/guards';
import { withTalentErrors } from '@/lib/talent/api';
import { talentClientInputSchema, talentListQuerySchema } from '@/lib/talent/schemas';
import { createTalentClient, listTalentClients } from '@/lib/talent/clients';

/** GET /api/owner/talent/clients — Owner-only client list. */
export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      await requireOwner();
      const query = parseWithSchema(talentListQuerySchema, parseSearchParams(req));
      const clients = await listTalentClients({
        query: query.q,
        status: query.status,
        limit: query.limit,
      });
      return { clients };
    })
  );
}

/** POST /api/owner/talent/clients — Owner-only client creation. */
export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      const actor = await requireOwner();
      const input = parseWithSchema(talentClientInputSchema, await readJsonBody(req));
      const client = await createTalentClient(actor.id, input);
      return { client };
    }),
    () => 201
  );
}
