import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import {
  countUnreadNotifications,
  listNotifications,
  notificationDeliveryStatus,
  NotificationDTO,
} from '@/lib/notifications/notifications';
import { getManagedSupportEntitlement } from '@/lib/support/entitlement';
import { AccountNav } from '@/components/account/account-nav';
import { NotificationsList } from '@/components/account/notifications-list';

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Your Ravelyth account notifications.',
  robots: { index: false, follow: false },
};

export default async function NotificationsPage(): Promise<React.ReactElement> {
  const user = await requireUser();

  let notifications: NotificationDTO[] = [];
  let unreadCount = 0;
  let entitled = false;
  let loadError: string | null = null;
  try {
    [notifications, unreadCount, entitled] = await Promise.all([
      listNotifications(user.id, { limit: 100 }),
      countUnreadNotifications(user.id),
      getManagedSupportEntitlement(user.id).then((e) => e.entitled),
    ]);
  } catch {
    loadError = 'Notifications could not be loaded right now. Please try again shortly.';
  }

  const delivery = notificationDeliveryStatus();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Notifications</h1>
        {unreadCount > 0 && !loadError ? (
          <p className="rounded-full bg-accent-tint px-3 py-1 text-sm font-medium text-accent-soft">
            {unreadCount} unread
          </p>
        ) : null}
      </div>
      <AccountNav entitled={entitled} />

      {loadError ? (
        <p role="alert" className="mt-8 rounded-md bg-red-500/10 p-3 text-sm text-red-300">
          {loadError}
        </p>
      ) : (
        <NotificationsList initialNotifications={notifications} />
      )}

      <p className="mt-4 text-xs text-slate-400">
        {delivery.email
          ? 'Notifications are delivered in-app and by email.'
          : 'Notifications are delivered in-app. Email delivery is not configured, so Ravelyth does not claim any email was sent.'}
      </p>
    </div>
  );
}
