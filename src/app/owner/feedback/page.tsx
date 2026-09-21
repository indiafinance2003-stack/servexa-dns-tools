import Link from 'next/link';
import { requireOwner } from '@/lib/admin/guards';
import { listAllFeedback } from '@/lib/feedback/service';
import { FeedbackTriage } from '@/components/feedback/feedback-triage';

export const metadata = {
  title: 'Feedback',
  robots: { index: false, follow: false },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso)
  );
}

export default async function OwnerFeedbackPage() {
  await requireOwner();
  const items = await listAllFeedback({});

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Customer feedback</h1>
        <Link href="/owner" className="text-sm font-medium text-accent hover:text-accent-strong">
          Back to Owner Room
        </Link>
      </div>
      <p className="mt-2 text-sm text-muted">
        Private inbox. Feedback is customer-submitted and never shown publicly.
      </p>

      {items.length === 0 ? (
        <p className="mt-8 text-sm text-slate-400">No feedback has been submitted yet.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-line bg-navy-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">
                    {item.authorName || 'Unknown'} ·{' '}
                    <span className="font-mono text-xs text-slate-400">{item.authorEmail}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.categoryLabel} ·{' '}
                    <span aria-label={`${item.rating} out of 5 stars`}>
                      {'★'.repeat(item.rating)}
                      <span className="text-slate-600">{'★'.repeat(5 - item.rating)}</span>
                    </span>{' '}
                    · {formatDate(item.createdAt)}
                  </p>
                </div>
                <FeedbackTriage feedbackId={item.id} currentStatus={item.status} />
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{item.message}</p>
              {item.handledAt ? (
                <p className="mt-2 text-xs text-slate-500">Handled {formatDate(item.handledAt)}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}