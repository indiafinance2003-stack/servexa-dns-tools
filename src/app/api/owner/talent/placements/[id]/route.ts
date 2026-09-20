import { NextRequest } from 'next/server';
import { handleApi, parseWithSchema, readJsonBody } from '@/lib/errors/api-handler';
import { requireOwner } from '@/lib/admin/guards';
import { withTalentErrors } from '@/lib/talent/api';
import { talentPaymentStatusSchema } from '@/lib/talent/schemas';
import { updatePlacementPaymentStatus } from '@/lib/talent/placements';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/owner/talent/placements/[id]
 * Payment bookkeeping only — no fake payment confirmation is ever produced;
 * this records the owner's real-world billing state for the placement fee.
 */
export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      const actor = await requireOwner();
      const { id } = await ctx.params;
      const input = parseWithSchema(talentPaymentStatusSchema, await readJsonBody(req));
      const placement = await updatePlacementPaymentStatus(actor.id, id, input.paymentStatus);
      return { placement };
    })
  );
}
