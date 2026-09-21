import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/admin/guards';
import { OwnerJobCreateForm } from './job-form';

export const metadata: Metadata = {
  title: 'New Job - Owner Talent',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function OwnerNewJobPage() {
  try {
    await requireOwner();
  } catch {
    redirect('/login?next=%2Fowner%2Ftalent%2Fjobs%2Fnew');
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">New job</h1>
          <p className="mt-1 text-sm text-muted">
            A job is created as a draft. Publishing it is a separate, explicit action.
          </p>
        </div>
        <Link
          href="/owner/talent/jobs"
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-navy-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-accent hover:shadow-sm"
        >
          <span className="text-lg" aria-hidden="true">&larr;</span> Back to Jobs
        </Link>
      </div>
      <div className="mt-6">
        <OwnerJobCreateForm />
      </div>
    </div>
  );
}

