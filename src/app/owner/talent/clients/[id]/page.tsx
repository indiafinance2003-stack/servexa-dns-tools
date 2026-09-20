import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/admin/guards';
import { OwnerClientDetailClient } from './client-detail';

export const metadata: Metadata = {
  title: 'Client Detail - Owner Talent',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OwnerClientDetailPage({ params }: Props) {
  try {
    await requireOwner();
  } catch {
    redirect('/login?next=%2Fowner%2Ftalent%2Fclients');
  }

  const { id } = await params;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Client</h1>
          <p className="mt-1 text-sm text-muted">
            Requirements, submissions, interviews and placement fees for this employer.
          </p>
        </div>
        <Link
          href="/owner/talent/clients"
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-accent hover:shadow-sm"
        >
          <span className="text-lg" aria-hidden="true">&larr;</span> Back to Clients
        </Link>
      </div>
      <div className="mt-6">
        <OwnerClientDetailClient clientId={id} />
      </div>
    </div>
  );
}

