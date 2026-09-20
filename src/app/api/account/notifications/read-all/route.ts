import { NextRequest } from 'next/server';
import { handleApi } from '@/lib/errors/api-handler';
import { requireSupportUser, withSupportErrors } from '@/lib/support/api';
import { markAllNotificationsRead } from '@/lib/notifications/notifications';

/** Marks every unread notification for the signed-in customer as read. */
export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(
    req,
    withSupportErrors(async () => {
      const user = await requireSupportUser();
      const updated = await markAllNotificationsRead(user.id);
      return { updated };
    })
  );
}
