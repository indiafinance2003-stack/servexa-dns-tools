import { NextRequest } from 'next/server';
import { handleApi, readJsonBody } from '@/lib/errors/api-handler';
import { parseWithSchema } from '@/lib/validation/parse';
import { assertTicketId, requireSupportEntitlement, requireSupportUser, withSupportErrors } from '@/lib/support/api';
import { applyCustomerTicketAction } from '@/lib/support/service';
import { customerTicketActionSchema } from '@/lib/support/schemas';

/** Customer ticket lifecycle actions: close, confirm resolution, reopen.
 *  All actions require an active Managed Support entitlement. */
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
      const input = parseWithSchema(customerTicketActionSchema, body);
      const ticket = await applyCustomerTicketAction(user.id, id, input.action, input.note);
      return { ticket };
    })
  );
}
