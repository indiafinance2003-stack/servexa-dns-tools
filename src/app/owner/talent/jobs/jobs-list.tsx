'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Job {
  id: string;
  jobId: string;
  title: string;
  status: string;
  employmentType: string;
  workMode: string;
  location: string | null;
  openings: number;
  clientId: string | null;
  clientName: string | null;
  experienceMin: number | null;
  experienceMax: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPublic: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

interface JobsResponse {
  success: boolean;
  data: { jobs: Job[] };
  error?: { message: string };
}

const statusClasses: Record<string, string> = {
  DRAFT: 'bg-slate-800 text-slate-300',
  OPEN: 'bg-emerald-500/100/15 text-emerald-300',
  PAUSED: 'bg-amber-500/100/15 text-amber-300',
  CLOSED: 'bg-red-500/100/15 text-red-300',
  FILLED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-red-500/100/15 text-red-300',
};

export function OwnerJobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadJobs = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (statusFilter) params.set('status', statusFilter);
    params.set('limit', '100');
    fetch(`/api/owner/talent/jobs?${params}`)
      .then((r) => r.json())
      .then((data: JobsResponse) => {
        if (data.success) {
          setJobs(data.data.jobs);
        } else {
          setError(data?.error?.message ?? 'Failed to load jobs');
        }
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  return (
    <div className="rounded-xl border border-line bg-navy-surface p-6">
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search title, description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border border-line bg-navy-surface px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent focus:outline-none w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-line bg-navy-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none w-40"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="OPEN">Open</option>
          <option value="PAUSED">Paused</option>
          <option value="CLOSED">Closed</option>
          <option value="FILLED">Filled</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        {loading && (
          <div className="ml-auto flex items-center gap-2 text-sm text-slate-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            Loading...
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
      )}

      {!loading && jobs.length === 0 && (
        <div className="mt-8 border border-dashed border-line py-12 text-center">
          <p className="text-sm text-slate-400">No jobs yet. Create your first job requirement.</p>
        </div>
      )}

      {!loading && jobs.length > 0 && (
        <div className="mt-4 divide-y divide-line">
          {jobs.map((job) => (
            <div key={job.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/owner/talent/jobs/${job.id}`} className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-ink truncate">{job.title}</p>
                  <p className="text-xs text-slate-400">{job.jobId}</p>
                </Link>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses[job.status] ?? 'bg-slate-800 text-slate-300'}`}>
                  {job.status}
                </span>
                <span className="text-xs text-slate-400">{job.employmentType}</span>
                <span className="text-xs text-slate-400">{job.workMode}</span>
                {job.location && <span className="text-xs text-slate-400">{job.location}</span>}
                {job.clientName && (
                  <span className="text-xs text-slate-400">Client: {job.clientName}</span>
                )}
                <span className="text-xs text-slate-400">{job.openings} opening{job.openings !== 1 ? 's' : ''}</span>
                <div className="ml-auto flex gap-2">
                  <Link href={`/owner/talent/jobs/${job.id}`} className="rounded-md px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10">
                    View
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
