import { NextRequest } from 'next/server';
import { handleApi, readJsonBody } from '@/lib/errors/api-handler';
import { parseWithSchema } from '@/lib/validation/parse';
import { assertTicketId, requireSupportEntitlement, requireSupportUser, withSupportErrors } from '@/lib/support/api';
import { replyToCustomerTicket } from '@/lib/support/service';
import { replyTicketSchema } from '@/lib/support/schemas';

/** Adds a customer reply to an owned ticket. Internal notes are staff-only and
 * cannot be created through this endpoint. Replying requires Managed Support. */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  return handleApi(
    req,
    withSupportErrors(async () => {
      const user = await requireSupportUser();
      await requireSupportEntitlement(user.id);
      const { id } = await context.params;
      assertTicketId(id);
      const body = await readJsonBody(req);
      const input = parseWithSchema(replyTicketSchema, body);
      const ticket = await replyToCustomerTicket(user.id, id, input.body);
      return { ticket };
    })
  );
}
