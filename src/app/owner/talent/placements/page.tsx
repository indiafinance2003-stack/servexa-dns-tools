import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/admin/guards';
import { OwnerPlacementsList } from './placements-list';

export const metadata: Metadata = {
  title: 'Placements - Owner Talent',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function OwnerPlacementsPage() {
  try {
    await requireOwner();
  } catch {
    redirect('/login?next=%2Fowner%2Ftalent%2Fplacements');
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Placements and fees</h1>
        <p className="mt-1 text-sm text-muted">
          Recorded placements and their fee bookkeeping. Payment states reflect what has actually happened — nothing here
          is auto-confirmed and no payment provider is simulated.
        </p>
      </div>
      <div className="mt-6">
        <OwnerPlacementsList />
      </div>
    </div>
  );
}
