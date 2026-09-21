import { NextRequest } from 'next/server';
import { handleApi } from '@/lib/errors/api-handler';
import { assertTicketId, requireSupportEntitlement, requireSupportUser, withSupportErrors } from '@/lib/support/api';
import { getCustomerTicket } from '@/lib/support/service';

/** Retrieves one owned ticket with its customer-visible conversation. Reading a
 *  ticket (even your own) requires an active Managed Support entitlement. */
export async function GET(
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
      const ticket = await getCustomerTicket(user.id, id);
      return { ticket };
    })
  );
}
