import { NextRequest } from 'next/server';
import { handleApi } from '@/lib/errors/api-handler';
import { requireSupportUser, withSupportErrors } from '@/lib/support/api';
import {
  countUnreadNotifications,
  listNotifications,
  notificationDeliveryStatus,
} from '@/lib/notifications/notifications';

/** Lists the signed-in customer's notifications, newest first. */
export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(
    req,
    withSupportErrors(async () => {
      const user = await requireSupportUser();
      const unreadOnly = req.nextUrl.searchParams.get('unread') === 'true';
      const limitParam = req.nextUrl.searchParams.get('limit');
      const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;
      const notifications = await listNotifications(user.id, {
        unreadOnly,
        limit: Number.isFinite(limit) ? limit : 50,
      });
      const unreadCount = await countUnreadNotifications(user.id);
      return { notifications, unreadCount, delivery: notificationDeliveryStatus() };
    })
  );
}
