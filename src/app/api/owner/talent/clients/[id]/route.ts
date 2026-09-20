import { NextRequest } from 'next/server';
import { handleApi, parseWithSchema, readJsonBody } from '@/lib/errors/api-handler';
import { requireOwner } from '@/lib/admin/guards';
import { withTalentErrors } from '@/lib/talent/api';
import { talentClientInputSchema } from '@/lib/talent/schemas';
import { getTalentClient, updateTalentClient } from '@/lib/talent/clients';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/owner/talent/clients/[id] — Owner-only client detail. */
export async function GET(req: NextRequest, ctx: RouteContext): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      await requireOwner();
      const { id } = await ctx.params;
      const client = await getTalentClient(id);
      return { client };
    })
  );
}

/** PATCH /api/owner/talent/clients/[id] — Owner-only client update. */
export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      const actor = await requireOwner();
      const { id } = await ctx.params;
      const input = parseWithSchema(talentClientInputSchema, await readJsonBody(req));
      const client = await updateTalentClient(actor.id, id, input);
      return { client };
    })
  );
}
