import type { Metadata } from 'next';
import Link from 'next/link';
import { employmentTypeLabel, TALENT_WORK_MODES, workModeLabel } from '@/lib/talent/catalog';
import { isTalentWorkMode } from '@/lib/talent/catalog';
import {
  formatExperienceBand,
  formatSalaryRangeMinor,
  listPublicJobs,
} from '@/lib/talent/public';

export const metadata: Metadata = {
  title: 'Open Positions',
  description:
    'Current open positions sourced by Ravelyth Talent — technology roles in support, NOC, Linux, QA and IT operations. Apply directly without an account.',
  alternates: { canonical: '/talent/jobs' },
};

interface PageProps {
  searchParams: Promise<{ q?: string; location?: string; workMode?: string }>;
}

export default async function TalentJobsPage({ searchParams }: PageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const q = (params.q ?? '').trim().slice(0, 120) || undefined;
  const location = (params.location ?? '').trim().slice(0, 120) || undefined;
  const workMode = isTalentWorkMode(params.workMode ?? '') ? params.workMode : undefined;

  const jobs = await listPublicJobs({ q, location, workMode });

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/talent" className="hover:text-accent">
          Talent
        </Link>
        <span aria-hidden="true"> / Open positions</span>
      </nav>
      <header className="mt-4">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Open positions</h1>
        <p className="mt-2 text-muted">
          Roles we are actively hiring for. Apply directly — no account needed.
        </p>
      </header>
      <form method="get" action="/talent/jobs" className="mt-6 rounded-xl border border-line bg-navy-surface p-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="q" className="block text-sm font-medium text-slate-300">Keyword</label>
            <input
              id="q"
              name="q"
              defaultValue={params.q}
              placeholder="Title or skill"
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-slate-300">Location</label>
            <input
              id="location"
              name="location"
              defaultValue={params.location}
              placeholder="e.g. Hyderabad"
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="workMode" className="block text-sm font-medium text-slate-300">Work mode</label>
            <select
              id="workMode"
              name="workMode"
              defaultValue={workMode ?? ''}
              className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              <option value="">Any</option>
              {TALENT_WORK_MODES.map((mode) => (
                <option key={mode} value={mode}>{workModeLabel(mode)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
            >
              Filter
            </button>
          </div>
        </div>
      </form>

      {jobs.length === 0 ? (
        <p className="mt-10 rounded-xl border border-line bg-navy-surface p-6 text-slate-400">
          No open positions match right now. Check back soon, or share your profile with us and we
          will keep you in mind for upcoming roles.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {jobs.map((job) => {
            const salary = formatSalaryRangeMinor(job.salaryMinMinor, job.salaryMaxMinor);
            const band = formatExperienceBand(job.experienceMin, job.experienceMax);
            return (
              <li
                key={job.jobCode}
                className="rounded-xl border border-line bg-navy-surface p-5 transition-shadow hover:shadow-sm"
              >
                <Link href={`/talent/jobs/${encodeURIComponent(job.jobCode)}`} className="block">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl font-semibold text-ink hover:text-accent">{job.title}</h2>
                    <span className="text-sm text-muted">{job.jobCode}</span>
                  </div>
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                    <span>{job.location ?? 'Location discussed during screening'}</span>
                    <span>{workModeLabel(job.workMode)}</span>
                    <span>{employmentTypeLabel(job.employmentType)}</span>
                    {band ? <span>{band}</span> : null}
                    {salary ? <span className="font-medium text-ink">{salary}</span> : null}
                  </p>
                  {job.requiredSkills.length > 0 ? (
                    <p className="mt-3 flex flex-wrap gap-1.5">
                      {job.requiredSkills.slice(0, 8).map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-paper px-2.5 py-0.5 text-xs text-slate-400"
                        >
                          {skill}
                        </span>
                      ))}
                      {job.requiredSkills.length > 8 ? (
                        <span className="px-1 text-xs text-muted">+{job.requiredSkills.length - 8} more</span>
                      ) : null}
                    </p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}