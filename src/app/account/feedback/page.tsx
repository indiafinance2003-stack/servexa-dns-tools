import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/require-user';
import { getManagedSupportEntitlement } from '@/lib/support/entitlement';
import { AccountNav } from '@/components/account/account-nav';
import { FeedbackForm } from '@/components/feedback/feedback-form';
import { listMyFeedback } from '@/lib/feedback/service';

export const metadata: Metadata = {
  title: 'Feedback',
  description: 'Send feedback about the Ravelyth tools.',
  robots: { index: false, follow: false },
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso)
  );
}

export default async function FeedbackPage(): Promise<React.ReactElement> {
  const user = await requireUser();

  let entitlement: Awaited<ReturnType<typeof getManagedSupportEntitlement>> | null = null;
  let items: Awaited<ReturnType<typeof listMyFeedback>> = [];
  try {
    [entitlement, items] = await Promise.all([
      getManagedSupportEntitlement(user.id),
      listMyFeedback(user.id),
    ]);
  } catch {
    // Render form-only; the list is best-effort.
    entitlement = null;
    items = [];
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Feedback</h1>
      <p className="mt-1 text-sm text-slate-400">
        Tell us what to improve. Feedback is private to the Ravelyth team and never shared publicly.
      </p>
      <AccountNav entitled={entitlement?.entitled ?? false} />

      <section className="mt-8 rounded-xl border border-line bg-navy-surface p-6">
        <h2 className="text-lg font-semibold text-ink">Send feedback</h2>
        <div className="mt-4">
          <FeedbackForm />
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-line bg-navy-surface p-6">
        <h2 className="text-lg font-semibold text-ink">Your previous feedback</h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            You have not submitted any feedback yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {items.map((item) => (
              <li key={item.id} className="rounded-md border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span>
                    {item.categoryLabel} ·{' '}
                    <span aria-label={`${item.rating} out of 5 stars`}>
                      {'★'.repeat(item.rating)}
                      <span className="text-slate-600">{'★'.repeat(5 - item.rating)}</span>
                    </span>
                  </span>
                  <span className="uppercase tracking-wide">{item.statusLabel}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{item.message}</p>
                <p className="mt-2 text-xs text-slate-500">Submitted {formatDate(item.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}