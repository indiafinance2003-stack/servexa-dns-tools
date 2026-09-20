import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/admin/guards';
import { OwnerClientsList } from './clients-list';

export const metadata: Metadata = {
  title: 'Clients - Owner Talent',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function OwnerClientsPage() {
  try {
    await requireOwner();
  } catch {
    redirect('/login?next=%2Fowner%2Ftalent%2Fclients');
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Clients</h1>
        <p className="mt-1 text-sm text-muted">
          Employer relationships behind the requirements. Client identity is never exposed on public job pages.
        </p>
      </div>
      <div className="mt-6">
        <OwnerClientsList />
      </div>
    </div>
  );
}
