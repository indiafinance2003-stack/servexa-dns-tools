import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/admin/guards';
import { Container } from '@/components/ui/container';
import { TalentJobDetailClient } from './job-detail';

export const metadata: Metadata = {
  title: 'Job Detail — Owner Talent',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function OwnerJobDetailPage({ params }: Props) {
  try {
    await requireOwner();
  } catch {
    redirect('/login?next=%2Fowner%2Ftalent%2Fjobs');
  }

  const { id } = await params;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Job Detail</h1>
          <p className="mt-1 text-sm text-muted">View and manage a specific job requirement.</p>
        </div>
        <Link
          href="/owner/talent/jobs"
          className="inline-flex items-center gap-2 rounded-lg border border-line bg-navy-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-accent hover:shadow-sm"
        >
          <span className="text-lg">←</span> Back to Jobs
        </Link>
      </div>
      <Container className="mt-6">
        <TalentJobDetailClient jobId={id} />
      </Container>
    </div>
  );
}

