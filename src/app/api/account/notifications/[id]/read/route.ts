import { NextRequest } from 'next/server';
import { handleApi } from '@/lib/errors/api-handler';
import { requireSupportUser, withSupportErrors } from '@/lib/support/api';
import { assertTicketId } from '@/lib/support/api';
import { markNotificationRead } from '@/lib/notifications/notifications';

/** Marks one owned notification as read. Ids are UUID-guarded before use. */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  return handleApi(
    req,
    withSupportErrors(async () => {
      const user = await requireSupportUser();
      const { id } = await context.params;
      assertTicketId(id);
      const notification = await markNotificationRead(user.id, id);
      return { notification };
    })
  );
}
