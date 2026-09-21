import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { dbFromRequest } from '@/lib/db/request';
import { talentJobs } from '@/lib/db/schema';
import { TalentApplyForm } from '@/components/talent/apply-form';

interface Props {
  params: Promise<{ jobId: string }>;
}

/**
 * Public application page for one specific job.
 *
 * Candidates NEVER need a Ravelyth customer account: this page is public and
 * the submitted application lands directly in the Owner Talent Room with
 * status NEW. The page is intentionally noindex — private submission flow.
 */
export const metadata: Metadata = {
  title: 'Apply — Ravelyth Talent',
  description: 'Apply for this position with Ravelyth Talent.',
  robots: { index: false, follow: false },
};

export default async function TalentApplyPage({ params }: Props) {
  const { jobId } = await params;
  const code = decodeURIComponent(jobId);
  if (!/^[A-Za-z0-9-]{3,32}$/.test(code)) notFound();

  const { db } = dbFromRequest();
  const rows = await db.select().from(talentJobs).where(eq(talentJobs.jobId, code)).limit(1);
  const job = rows[0];
  // Only openly-published jobs accept applications.
  if (!job || job.status !== 'OPEN') notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/talent/jobs" className="hover:text-accent">
          Open positions
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-slate-300">{job.jobId}</span>
      </nav>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">Apply: {job.title}</h1>
      <p className="mt-2 text-sm text-muted">
        {job.location ?? 'Location discussed during screening'} · {job.workMode === 'remote' ? 'Remote' : job.workMode === 'hybrid' ? 'Hybrid' : 'On-site'} · Reference {job.jobId}
      </p>
      <div className="mt-8">
        <TalentApplyForm
          job={{
            code: job.jobId,
            title: job.title,
            location: job.location,
            workMode: job.workMode,
          }}
        />
      </div>
    </div>
  );
}
