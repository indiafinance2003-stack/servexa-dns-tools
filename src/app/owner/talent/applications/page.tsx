import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/admin/guards';
import { OwnerApplicationsList } from './applications-list';

export const metadata: Metadata = {
  title: 'Applications - Owner Talent',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function OwnerApplicationsPage() {
  try {
    await requireOwner();
  } catch {
    redirect('/login?next=%2Fowner%2Ftalent%2Fapplications');
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Applications</h1>
        <p className="mt-1 text-sm text-muted">
          Pipeline across every job. Client submission stays blocked on the server until the candidate has been
          contacted and has confirmed interest.
        </p>
      </div>
      <div className="mt-6">
        <OwnerApplicationsList />
      </div>
    </div>
  );
}
