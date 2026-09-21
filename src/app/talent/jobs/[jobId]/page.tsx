import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { config } from '@/lib/config';
import { employmentTypeLabel, workModeLabel } from '@/lib/talent/catalog';
import {
  formatExperienceBand,
  formatSalaryRangeMinor,
  getPublicJobByCode,
} from '@/lib/talent/public';

interface PageProps {
  params: Promise<{ jobId: string }>;
}

function validJobCode(code: string): string {
  return /^[A-Za-z0-9-]{3,32}$/.test(code) ? code : '';
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { jobId } = await params;
  const code = validJobCode(decodeURIComponent(jobId));
  if (!code) return { title: 'Position not found' };
  try {
    const job = await getPublicJobByCode(code);
    const canonical = `${config.APP_URL}/talent/jobs/${job.jobCode}`;
    const description = job.description.slice(0, 160);
    return {
      title: `${job.title} — Open position`,
      description,
      alternates: { canonical: `/talent/jobs/${job.jobCode}` },
      openGraph: { title: job.title, description, url: canonical },
      twitter: { card: 'summary', title: job.title, description },
    };
  } catch {
    return { title: 'Position not found' };
  }
}

export default async function TalentJobDetailPage({ params }: PageProps): Promise<React.ReactElement> {
  const { jobId } = await params;
  const code = validJobCode(decodeURIComponent(jobId));
  if (!code) notFound();

  let job: Awaited<ReturnType<typeof getPublicJobByCode>>;
  try {
    job = await getPublicJobByCode(code);
  } catch {
    notFound();
  }
  const salary = formatSalaryRangeMinor(job.salaryMinMinor, job.salaryMaxMinor);
  const band = formatExperienceBand(job.experienceMin, job.experienceMax);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/talent" className="hover:text-accent">Talent</Link>
        <span aria-hidden="true"> / </span>
        <Link href="/talent/jobs" className="hover:text-accent">Open positions</Link>
        <span aria-hidden="true"> / {job.jobCode}</span>
      </nav>

      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{job.title}</h1>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
          <span>{job.location ?? 'Location discussed during screening'}</span>
          <span>{workModeLabel(job.workMode)}</span>
          <span>{employmentTypeLabel(job.employmentType)}</span>
          {band ? <span>{band}</span> : null}
          {salary ? <span className="font-medium text-ink">{salary}</span> : null}
        </p>
        <p className="mt-1 text-sm text-muted">Reference {job.jobCode}</p>
      </header>

      <div className="mt-8 rounded-xl border border-line bg-navy-surface p-6">
        <h2 className="text-xl font-semibold text-ink">About the role</h2>
        <div className="mt-3 whitespace-pre-line text-slate-300">{job.description}</div>

        {job.qualification || job.shift ? (
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            {job.qualification ? (
              <div>
                <dt className="text-sm font-medium text-slate-300">Qualification</dt>
                <dd className="mt-1 text-sm text-slate-400">{job.qualification}</dd>
              </div>
            ) : null}
            {job.shift ? (
              <div>
                <dt className="text-sm font-medium text-slate-300">Shift</dt>
                <dd className="mt-1 text-sm text-slate-400">{job.shift}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {job.requiredSkills.length > 0 || job.preferredSkills.length > 0 ? (
          <div className="mt-6 space-y-4">
            {job.requiredSkills.length > 0 ? (
              <div>
                <h3 className="text-sm font-medium text-slate-300">Required skills</h3>
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {job.requiredSkills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-paper px-2.5 py-0.5 text-xs text-slate-400"
                    >
                      {skill}
                    </span>
                  ))}
                </p>
              </div>
            ) : null}
            {job.preferredSkills.length > 0 ? (
              <div>
                <h3 className="text-sm font-medium text-slate-300">Good to have</h3>
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {job.preferredSkills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-paper px-2.5 py-0.5 text-xs text-slate-400"
                    >
                      {skill}
                    </span>
                  ))}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-6 rounded-xl border border-line bg-navy-surface p-6 text-center">
        <h2 className="text-xl font-semibold text-ink">Interested in this role?</h2>
        <p className="mt-2 text-sm text-slate-400">
          Apply directly with your details and resume. No account needed, and we never charge
          candidates a fee.
        </p>
        <Link
          href={`/talent/jobs/${encodeURIComponent(job.jobCode)}/apply`}
          className="mt-4 inline-block rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-strong"
        >
          Apply for this position
        </Link>
      </div>
    </main>
  );
}