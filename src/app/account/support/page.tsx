import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/require-user';
import { listCustomerTickets } from '@/lib/support/service';
import { AccountNav } from '@/components/account/account-nav';
import { statusLabel, priorityLabel, categoryLabel } from '@/lib/support/catalog';

export const metadata: Metadata = {
  title: 'Support Tickets',
  description: 'Your Ravelyth support tickets.',
  robots: { index: false, follow: false },
};

const statusBadgeClasses: Record<string, string> = {
  open: 'bg-sky-50 text-sky-700',
  in_progress: 'bg-amber-50 text-amber-700',
  waiting_for_customer: 'bg-purple-50 text-purple-700',
  resolved: 'bg-emerald-50 text-emerald-700',
  closed: 'bg-slate-100 text-slate-600',
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(iso));
}

export default async function AccountSupportPage(): Promise<React.ReactElement> {
  const user = await requireUser();

  let tickets: Awaited<ReturnType<typeof listCustomerTickets>> = [];
  let loadError: string | null = null;
  try {
    tickets = await listCustomerTickets(user.id, { limit: 100 });
  } catch {
    loadError = 'Your tickets could not be loaded right now. Please try again shortly.';
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Support</h1>
        <Link
          href="/support/request"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
        >
          New request
        </Link>
      </div>
      <AccountNav />

      {loadError ? (
        <p role="alert" className="mt-8 rounded-md bg-red-50 p-3 text-sm text-red-800">
          {loadError}
        </p>
      ) : tickets.length === 0 ? (
        <section className="mt-8 rounded-xl border border-line bg-white p-6">
          <h2 className="text-lg font-semibold text-ink">No support requests yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            When you open a request it appears here with a reference number, its status, and the full
            conversation with Ravelyth support.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link
              href="/support/request"
              className="rounded-md border border-line px-3 py-1.5 text-slate-700 hover:border-accent hover:text-accent"
            >
              Open a support request
            </Link>
            <Link
              href="/docs"
              className="rounded-md border border-line px-3 py-1.5 text-slate-700 hover:border-accent hover:text-accent"
            >
              Browse the Knowledge Base
            </Link>
          </div>
        </section>
      ) : (
        <ul className="mt-8 space-y-3">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="rounded-xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-slate-500">{ticket.reference}</p>
                  <h2 className="mt-0.5 truncate text-base font-semibold text-ink">
                    <Link href={`/account/support/${ticket.id}`} className="hover:text-accent">
                      {ticket.subject}
                    </Link>
                  </h2>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    statusBadgeClasses[ticket.status] ?? 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {statusLabel(ticket.status)}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {categoryLabel(ticket.category)} · {priorityLabel(ticket.priority)} priority
                {ticket.affectedDomain ? ` · ${ticket.affectedDomain}` : ''}
                {ticket.relatedTool ? ` · via ${ticket.relatedTool.replace(/_/g, ' ')}` : ''} ·{' '}
                {ticket.messageCount} message{ticket.messageCount === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Opened {formatDate(ticket.createdAt)} UTC · Updated {formatDate(ticket.updatedAt)} UTC
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
