import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/require-user';
import { getCustomerTicket, CustomerTicketDetail } from '@/lib/support/service';
import { TicketConversation } from '@/components/support/ticket-conversation';
import { AccountNav } from '@/components/account/account-nav';
import {
  statusLabel,
  priorityLabel,
  categoryLabel,
  originLabel,
  authorRoleLabel,
} from '@/lib/support/catalog';
import { describeDiagnosticContext, parseDiagnosticContext } from '@/lib/support/context';

export const metadata: Metadata = {
  title: 'Support Ticket',
  description: 'Your Ravelyth support ticket.',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ id: string }>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export default async function TicketDetailPage({ params }: PageProps): Promise<React.ReactElement> {
  const { id } = await params;
  // Malformed ids are simply not found — no database round trip, no enumeration.
  if (!UUID_PATTERN.test(id)) notFound();

  const user = await requireUser();

  let ticket: CustomerTicketDetail | null = null;
  let loadError: string | null = null;
  try {
    ticket = await getCustomerTicket(user.id, id);
  } catch {
    // TicketNotFoundError (foreign or missing ticket) and infrastructure
    // failures are intentionally indistinguishable here: foreign tickets are
    // never confirmed to exist.
    loadError =
      'This ticket could not be loaded. It may not exist, or the service is temporarily unavailable.';
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm">
        <Link href="/account/support" className="font-medium text-accent hover:text-accent-strong">
          ← All support requests
        </Link>
      </p>
      <AccountNav />
      <TicketBody ticket={ticket} loadError={loadError} />
    </div>
  );
}

function TicketBody({
  ticket,
  loadError,
}: {
  ticket: CustomerTicketDetail | null;
  loadError: string | null;
}): React.ReactElement {
  if (loadError || !ticket) {
    return (
      <p role="alert" className="mt-8 rounded-md bg-red-50 p-3 text-sm text-red-800">
        {loadError ?? 'This ticket could not be loaded.'}
      </p>
    );
  }

  return (
    <>
      <div className="mt-8 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-slate-500">{ticket.reference}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{ticket.subject}</h1>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            statusBadgeClasses[ticket.status] ?? 'bg-slate-100 text-slate-600'
          }`}
        >
          {statusLabel(ticket.status)}
        </span>
      </div>

      <section className="mt-6 rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Request details</h2>
        <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-600">Area</dt>
            <dd className="mt-0.5 font-medium text-ink">{categoryLabel(ticket.category)}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Priority</dt>
            <dd className="mt-0.5 font-medium text-ink">{priorityLabel(ticket.priority)}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Queue</dt>
            <dd className="mt-0.5 font-medium text-ink">{originLabel(ticket.origin)}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Affected domain</dt>
            <dd className="mt-0.5 font-mono text-ink">{ticket.affectedDomain ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Opened</dt>
            <dd className="mt-0.5 text-ink">{formatDate(ticket.createdAt)} UTC</dd>
          </div>
          <div>
            <dt className="text-slate-600">Last update</dt>
            <dd className="mt-0.5 text-ink">{formatDate(ticket.updatedAt)} UTC</dd>
          </div>
        </dl>
        {ticket.relatedService ? (
          <p className="mt-4 text-sm text-slate-600">
            Related service:{' '}
            <Link
              href={`/services/${ticket.relatedService}`}
              className="font-medium text-accent hover:text-accent-strong"
            >
              {ticket.relatedService.replace(/-/g, ' ')}
            </Link>
          </p>
        ) : null}
      </section>

      <section className="mt-4 rounded-xl border border-line bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Original request</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{ticket.description}</p>
      </section>

      <DiagnosticSummary ticket={ticket} />

      <TicketConversation
        ticketId={ticket.id}
        messages={ticket.messages.map((message) => ({
          id: message.id,
          authorLabel: authorRoleLabel(message.authorRole),
          body: message.body,
          createdAt: message.createdAt,
        }))}
        canReply={ticket.capabilities.canReply}
        canClose={ticket.capabilities.canClose}
        canReopen={ticket.capabilities.canReopen}
        canConfirmResolution={ticket.capabilities.canConfirmResolution}
      />
    </>
  );
}

function DiagnosticSummary({ ticket }: { ticket: CustomerTicketDetail }): React.ReactElement | null {
  // Stored context is re-sanitized on read so hand-edited rows cannot inject
  // unexpected content into the page.
  const summary = describeDiagnosticContext(parseDiagnosticContext(ticket.context));
  if (!summary) return null;
  return (
    <section className="mt-4 rounded-xl border border-line bg-white p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Attached diagnostic</h2>
      <p className="mt-3 text-sm text-slate-700">{summary}</p>
    </section>
  );
}
