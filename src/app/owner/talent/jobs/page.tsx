import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/admin/guards';
import { Container } from '@/components/ui/container';
import { OwnerJobsList } from './jobs-list';

export const metadata: Metadata = {
  title: 'Jobs — Owner Talent',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function OwnerJobsPage() {
  try {
    await requireOwner();
  } catch {
    redirect('/login?next=%2Fowner%2Ftalent%2Fjobs');
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Jobs</h1>
          <p className="mt-1 text-sm text-muted">Manage technology job requirements.</p>
        </div>
        <Link
          href="/owner/talent/jobs/new"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
        >
          <span className="text-lg leading-none">+</span> New Job
        </Link>
      </div>
      <Container className="mt-6">
        <OwnerJobsList />
      </Container>
    </div>
  );
}


