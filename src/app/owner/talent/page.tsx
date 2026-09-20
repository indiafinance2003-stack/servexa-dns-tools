import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/admin/guards';
import { TalentDashboardCard } from './dashboard-card';

export const metadata: Metadata = {
  title: 'Talent — Owner Room',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function OwnerTalentPage() {
  try {
    await requireOwner();
  } catch {
    redirect('/login?next=%2Fowner%2Ftalent');
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Talent</h1>
      <p className="mt-1 text-sm text-muted">
        Recruitment pipeline for technology talent sourcing.
      </p>
      <div className="mt-6">
        <TalentDashboardCard />
      </div>
      <div className="mt-8 border-t border-line pt-6">
        <h2 className="text-lg font-semibold text-ink">Quick access</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/owner/talent/jobs" className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:border-accent hover:shadow-sm">
            <span className="text-lg">💼</span> Jobs
          </Link>
          <Link href="/owner/talent/candidates" className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:border-accent hover:shadow-sm">
            <span className="text-lg">👤</span> Candidates
          </Link>
          <Link href="/owner/talent/applications" className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:border-accent hover:shadow-sm">
            <span className="text-lg">📋</span> Applications
          </Link>
          <Link href="/owner/talent/clients" className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:border-accent hover:shadow-sm">
            <span className="text-lg">🏢</span> Clients
          </Link>
          <Link href="/owner/talent/interviews" className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:border-accent hover:shadow-sm">
            <span className="text-lg">📅</span> Interviews
          </Link>
          <Link href="/owner/talent/placements" className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:border-accent hover:shadow-sm">
            <span className="text-lg">✅</span> Placements
          </Link>
        </div>
      </div>
    </div>
  );
}


