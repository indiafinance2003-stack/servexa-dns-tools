import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/admin/guards';
import { OwnerInterviewsList } from './interviews-list';

export const metadata: Metadata = {
  title: 'Interviews - Owner Talent',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function OwnerInterviewsPage() {
  try {
    await requireOwner();
  } catch {
    redirect('/login?next=%2Fowner%2Ftalent%2Finterviews');
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Interviews</h1>
        <p className="mt-1 text-sm text-muted">
          Interview rounds with their candidate and job context. Scheduling and feedback updates are Owner-only.
        </p>
      </div>
      <div className="mt-6">
        <OwnerInterviewsList />
      </div>
    </div>
  );
}
