import { NextRequest } from 'next/server';
import { handleApi, parseSearchParams, readJsonBody } from '@/lib/errors/api-handler';
import { parseWithSchema } from '@/lib/validation/parse';
import {
  checkTicketCreateRateLimit,
  requireSupportEntitlement,
  requireSupportUser,
  withSupportErrors,
} from '@/lib/support/api';
import { createCustomerTicket, listCustomerTickets } from '@/lib/support/service';
import { createTicketSchema, ticketListQuerySchema } from '@/lib/support/schemas';

/** Lists the signed-in customer's own tickets. Ownership is server-resolved and
 *  listing requires an active Managed Support entitlement. */
export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(
    req,
    withSupportErrors(async () => {
      const user = await requireSupportUser();
      await requireSupportEntitlement(user.id);
      const query = parseWithSchema(ticketListQuerySchema, parseSearchParams(req));
      const tickets = await listCustomerTickets(user.id, {
        status: query.status,
        limit: query.limit,
      });
      return { tickets };
    })
  );
}

/**
 * Creates a ticket for the signed-in customer. Ticket origin is always
 * `managed_support`: every ticket requires an active Managed Support
 * entitlement (enforced both here and in the service layer).
 */
export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(
    req,
    withSupportErrors(async () => {
      const user = await requireSupportUser();
      await requireSupportEntitlement(user.id);
      checkTicketCreateRateLimit(user.id);
      const body = await readJsonBody(req);
      const input = parseWithSchema(createTicketSchema, body);
      const result = await createCustomerTicket(user.id, input);
      return result;
    }),
    () => 201
  );
}
