import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/require-user';
import { listSavedAnalyses, SavedAnalysisSummary } from '@/lib/account/saved-analyses';
import { getManagedSupportEntitlement } from '@/lib/support/entitlement';
import { SavedAnalysesList } from '@/components/account/saved-analyses-list';
import { AccountNav } from '@/components/account/account-nav';

export const metadata: Metadata = {
  title: 'Your Account',
  description: 'Your Ravelyth account.',
  robots: { index: false, follow: false },
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date);
}

export default async function AccountPage(): Promise<React.ReactElement> {
  const user = await requireUser();

  let saved: SavedAnalysisSummary[] = [];
  let savedError: string | null = null;
  let entitled = false;
  try {
    [saved, entitled] = await Promise.all([
      listSavedAnalyses(user.id),
      getManagedSupportEntitlement(user.id).then((e) => e.entitled),
    ]);
  } catch {
    savedError =
      'Saved analyses could not be loaded right now. The account service may be temporarily unavailable.';
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Your account</h1>
        {/* Plain HTML form POST: works without JavaScript. /logout is a
            POST-only route handler, never a rendered page. */}
        <form method="post" action="/logout">
          <button
            type="submit"
            className="rounded-md border border-line px-4 py-2 text-sm font-medium text-slate-300 hover:border-red-300 hover:text-red-300"
          >
            Log out
          </button>
        </form>
      </div>
      <AccountNav entitled={entitled} />

      <section className="mt-8 rounded-xl border border-line bg-navy-surface p-6">
        <h2 className="text-lg font-semibold text-ink">Profile</h2>
        <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-400">Name</dt>
            <dd className="mt-0.5 text-sm font-medium text-ink">{user.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-400">Email</dt>
            <dd className="mt-0.5 text-sm font-medium text-ink">{user.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-400">Account created</dt>
            <dd className="mt-0.5 text-sm font-medium text-ink">{formatDate(user.createdAt)} UTC</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-400">Last sign-in</dt>
            <dd className="mt-0.5 text-sm font-medium text-ink">
              {user.lastLoginAt ? `${formatDate(user.lastLoginAt)} UTC` : '—'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-xl border border-line bg-navy-surface p-6">
        <h2 className="text-lg font-semibold text-ink">Saved analyses</h2>
        <p className="mt-2 text-sm text-muted">
          Analyses you saved explicitly from the DNS Lookup tool. Saved items are private to your account.
        </p>
        <div className="mt-4">
          {savedError ? (
            <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-300">{savedError}</p>
          ) : (
            <SavedAnalysesList
              items={saved.map((item) => ({
                id: item.id,
                analysisType: item.analysisType,
                target: item.target,
                result: item.result,
                createdAt: item.createdAt.toISOString(),
              }))}
            />
          )}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-line bg-navy-surface p-6">
        <h2 className="text-lg font-semibold text-ink">Public tools</h2>
        <p className="mt-2 text-sm text-muted">
          All diagnostics remain free and available without an account.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link href="/dns/lookup" className="rounded-md border border-line px-3 py-1.5 text-slate-300 hover:border-accent hover:text-accent">
            DNS Lookup
          </Link>
          <Link href="/dns/analyze" className="rounded-md border border-line px-3 py-1.5 text-slate-300 hover:border-accent hover:text-accent">
            DNS Health
          </Link>
          <Link href="/email/analyze" className="rounded-md border border-line px-3 py-1.5 text-slate-300 hover:border-accent hover:text-accent">
            Email Headers
          </Link>
        </div>
      </section>
    </div>
  );
}
