'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface TalentApplicationRow {
  id: string;
  applicationId: string;
  candidateId: string;
  candidateCode: string;
  jobId: string;
  jobCode: string;
  jobTitle: string;
  source: string;
  status: string;
  clientSubmissionDate: string | null;
  createdAt: string;
}

interface ApplicationsResponse {
  success: boolean;
  data?: { applications: TalentApplicationRow[] };
  error?: { message?: string };
}

const STATUSES = [
  'NEW',
  'SCREENING',
  'CONTACTED',
  'INTERESTED',
  'SHORTLISTED',
  'CLIENT_SUBMITTED',
  'INTERVIEW',
  'SELECTED',
  'OFFER',
  'JOINED',
  'REJECTED',
  'WITHDRAWN',
  'NO_RESPONSE',
  'ON_HOLD',
] as const;

const statusClasses: Record<string, string> = {
  NEW: 'bg-slate-100 text-slate-700',
  SCREENING: 'bg-blue-100 text-blue-700',
  CONTACTED: 'bg-purple-100 text-purple-700',
  INTERESTED: 'bg-indigo-100 text-indigo-700',
  SHORTLISTED: 'bg-emerald-100 text-emerald-700',
  CLIENT_SUBMITTED: 'bg-cyan-100 text-cyan-700',
  INTERVIEW: 'bg-amber-100 text-amber-700',
  SELECTED: 'bg-blue-100 text-blue-700',
  OFFER: 'bg-violet-100 text-violet-700',
  JOINED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  WITHDRAWN: 'bg-slate-100 text-slate-700',
  NO_RESPONSE: 'bg-slate-100 text-slate-700',
  ON_HOLD: 'bg-yellow-100 text-yellow-700',
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN');
}

export function OwnerApplicationsList() {
  const [applications, setApplications] = useState<TalentApplicationRow[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      params.set('limit', '200');
      const res = await fetch('/api/owner/talent/applications?' + params.toString());
      const json: ApplicationsResponse = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? 'Failed to load applications');
        return;
      }
      setApplications(json.data?.applications ?? []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-xl border border-line bg-white p-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600" htmlFor="application-status-filter">
          Status
        </label>
        <select
          id="application-status-filter"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-52 rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
        >
          <option value="">All statuses</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">{applications.length} shown</span>
        {loading ? (
          <div className="ml-auto flex items-center gap-2 text-sm text-slate-500">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            Loading...
          </div>
        ) : null}
      </div>

      {error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {!loading && applications.length === 0 ? (
        <div className="mt-8 border border-dashed border-line py-12 text-center">
          <p className="text-sm text-slate-500">
            {status ? 'No applications with this status.' : 'No applications yet. They arrive through public job postings.'}
          </p>
        </div>
      ) : null}

      {applications.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4 font-medium">Application</th>
                <th className="py-2 pr-4 font-medium">Candidate</th>
                <th className="py-2 pr-4 font-medium">Job</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Client submission</th>
                <th className="py-2 pr-4 font-medium">Applied</th>
                <th className="py-2 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="border-b border-line last:border-0">
                  <td className="py-3 pr-4 text-sm">
                    <Link href={'/owner/talent/applications/' + app.id} className="font-medium text-accent hover:underline">
                      {app.applicationId}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-sm">
                    <Link href={'/owner/talent/candidates/' + app.candidateId} className="text-accent hover:underline">
                      {app.candidateCode}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-sm">
                    <Link href={'/owner/talent/jobs/' + app.jobId} className="text-accent hover:underline">
                      {app.jobTitle}
                    </Link>
                    <span className="ml-2 text-xs text-slate-400">{app.jobCode}</span>
                  </td>
                  <td className="py-3 pr-4 text-sm">
                    <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium ' + (statusClasses[app.status] ?? 'bg-slate-100 text-slate-700')}>
                      {app.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-500">
                    {app.clientSubmissionDate ? formatDate(app.clientSubmissionDate) : 'Not submitted'}
                  </td>
                  <td className="py-3 pr-4 text-xs text-slate-500">{formatDate(app.createdAt)}</td>
                  <td className="py-3 text-xs text-slate-500">{app.source.replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
