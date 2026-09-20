'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost, formatApiError } from '@/lib/client/api';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const typeLabels: Record<string, string> = {
  ticket_created: 'Support request created',
  ticket_reply: 'Support reply',
  ticket_status_changed: 'Ticket status changed',
  subscription_created: 'Subscription created',
  subscription_status_changed: 'Subscription status changed',
  invoice_issued: 'Invoice issued',
  invoice_paid: 'Invoice paid',
  account: 'Account',
};

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

export function NotificationsList({
  initialNotifications,
}: {
  initialNotifications: NotificationItem[];
}): React.ReactElement {
  const router = useRouter();
  const [items, setItems] = useState(initialNotifications);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function markRead(id: string) {
    setBusy(id);
    setError(null);
    try {
      const updated = await apiPost<NotificationItem>(`/api/account/notifications/${id}/read`, {});
      setItems((current) => current.map((item) => (item.id === id ? { ...item, ...updated } : item)));
      router.refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(null);
    }
  }

  async function markAllRead() {
    setBusy('all');
    setError(null);
    try {
      await apiPost<{ updated: number }>('/api/account/notifications/read-all', {});
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      router.refresh();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <section className="mt-8 rounded-xl border border-line bg-white p-6">
        <h2 className="text-lg font-semibold text-ink">No notifications yet</h2>
        <p className="mt-2 text-sm text-slate-600">
          Notifications appear here when something changes in your account — for example a reply on a
          support request or a ticket status change.
        </p>
      </section>
    );
  }

  const unread = items.filter((item) => !item.read).length;

  return (
    <section className="mt-8">
      {error ? (
        <p role="alert" className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {unread > 0 ? (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={markAllRead}
            disabled={busy !== null}
            className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {busy === 'all' ? 'Marking…' : `Mark all as read (${unread})`}
          </button>
        </div>
      ) : null}

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className={`rounded-xl border p-5 ${
              item.read ? 'border-line bg-white' : 'border-accent/40 bg-accent-tint/40'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {typeLabels[item.type] ?? item.type}
                </p>
                <p className="mt-1 font-medium text-ink">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                <p className="mt-1 text-xs text-slate-500">{formatTime(item.createdAt)} UTC</p>
                {item.link ? (
                  <a href={item.link} className="mt-2 inline-block text-sm font-medium text-accent hover:text-accent-strong">
                    Open
                  </a>
                ) : null}
              </div>
              {!item.read ? (
                <button
                  type="button"
                  onClick={() => markRead(item.id)}
                  disabled={busy !== null}
                  className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-accent hover:text-accent disabled:opacity-60"
                >
                  {busy === item.id ? 'Marking…' : 'Mark read'}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
