import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/require-user';
import { getManagedSupportEntitlement } from '@/lib/support/entitlement';
import { listCustomerTickets } from '@/lib/support/service';
import { AccountNav } from '@/components/account/account-nav';
import { statusLabel, priorityLabel, categoryLabel } from '@/lib/support/catalog';

export const metadata: Metadata = {
  title: 'Support Tickets',
  description: 'Your Ravelyth support tickets.',
  robots: { index: false, follow: false },
};

const statusBadgeClasses: Record<string, string> = {
  open: 'bg-sky-500/10 text-sky-200',
  in_progress: 'bg-amber-500/10 text-amber-300',
  waiting_for_customer: 'bg-purple-500/10 text-purple-300',
  resolved: 'bg-emerald-500/10 text-emerald-300',
  closed: 'bg-slate-800 text-slate-400',
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

  let entitled = false;
  let statusReason: string | null = null;
  const entitlement = await getManagedSupportEntitlement(user.id);
  entitled = entitlement.entitled;
  statusReason = entitlement.reason;

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
        {entitled ? (
          <Link
            href="/support/request"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
          >
            New request
          </Link>
        ) : (
          <Link
            href="/pricing"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
          >
            Get Managed Support
          </Link>
        )}
      </div>
      <AccountNav entitled={entitled} />

      {!entitled ? (
        <section className="mt-8 rounded-xl border border-line bg-navy-surface p-6">
          <h2 className="text-lg font-semibold text-ink">Managed Support is required</h2>
          <p className="mt-2 text-sm text-slate-400">
            Support tickets belong to the paid Managed Support plan. Your account has no active
            subscription{statusReason ? ` — ${statusReason}` : ''}. The free diagnostic tools and the
            Knowledge Base remain fully available.
          </p>
        </section>
      ) : loadError ? (
        <p role="alert" className="mt-8 rounded-md bg-red-500/10 p-3 text-sm text-red-300">
          {loadError}
        </p>
      ) : tickets.length === 0 ? (
        <section className="mt-8 rounded-xl border border-line bg-navy-surface p-6">
          <h2 className="text-lg font-semibold text-ink">No support requests yet</h2>
          <p className="mt-2 text-sm text-slate-400">
            When you open a request it appears here with a reference number, its status, and the full
            conversation with Ravelyth support.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link
              href="/support/request"
              className="rounded-md border border-line px-3 py-1.5 text-slate-300 hover:border-accent hover:text-accent"
            >
              Open a support request
            </Link>
            <Link
              href="/docs"
              className="rounded-md border border-line px-3 py-1.5 text-slate-300 hover:border-accent hover:text-accent"
            >
              Browse the Knowledge Base
            </Link>
          </div>
        </section>
      ) : (
        <ul className="mt-8 space-y-3">
          {tickets.map((ticket) => (
            <li key={ticket.id} className="rounded-xl border border-line bg-navy-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-slate-400">{ticket.reference}</p>
                  <h2 className="mt-0.5 truncate text-base font-semibold text-ink">
                    <Link href={`/account/support/${ticket.id}`} className="hover:text-accent">
                      {ticket.subject}
                    </Link>
                  </h2>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    statusBadgeClasses[ticket.status] ?? 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {statusLabel(ticket.status)}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {categoryLabel(ticket.category)} · {priorityLabel(ticket.priority)} priority
                {ticket.affectedDomain ? ` · ${ticket.affectedDomain}` : ''}
                {ticket.relatedTool ? ` · via ${ticket.relatedTool.replace(/_/g, ' ')}` : ''} ·{' '}
                {ticket.messageCount} message{ticket.messageCount === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Opened {formatDate(ticket.createdAt)} UTC · Updated {formatDate(ticket.updatedAt)} UTC
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
