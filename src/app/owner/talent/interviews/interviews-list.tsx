'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface InterviewRow {
  id: string;
  applicationId: string;
  round: string;
  scheduledAt: string | null;
  interviewType: string;
  meetingLink: string | null;
  interviewer: string | null;
  status: string;
  feedback: string | null;
  createdAt: string;
}

interface ApplicationRow {
  id: string;
  applicationId: string;
  candidateCode: string;
  jobTitle: string;
}

const STATUSES = ['SCHEDULED', 'COMPLETED', 'RESCHEDULED', 'NO_SHOW', 'CANCELLED', 'PASSED', 'FAILED'] as const;
const TYPES = ['video', 'phone', 'in_person', 'technical', 'hr'] as const;

const statusClasses: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-500/100/15 text-emerald-300',
  RESCHEDULED: 'bg-amber-500/100/15 text-amber-300',
  NO_SHOW: 'bg-red-500/100/15 text-red-300',
  CANCELLED: 'bg-slate-800 text-slate-300',
  PASSED: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-500/100/15 text-red-300',
};

const input = 'w-full rounded-md border border-line bg-navy-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none';
const label = 'block text-sm font-medium text-slate-300';

function formatWhen(value: string | null): string {
  if (!value) return 'Not scheduled';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('en-IN');
}

export function OwnerInterviewsList() {
  const [interviews, setInterviews] = useState<InterviewRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const [form, setForm] = useState({ applicationId: '', round: '', scheduledAt: '', interviewType: 'video', meetingLink: '', interviewer: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, appRes] = await Promise.all([
        fetch('/api/owner/talent/interviews?limit=200&upcomingOnly=' + (upcomingOnly ? 'true' : 'false')),
        fetch('/api/owner/talent/applications?limit=200'),
      ]);
      const listJson = await listRes.json();
      if (!listRes.ok || !listJson.success) {
        setError(listJson?.error?.message ?? 'Failed to load interviews');
        return;
      }
      setInterviews(listJson.data.interviews ?? []);
      const appJson = await appRes.json();
      if (appRes.ok && appJson.success) {
        setApplications(appJson.data.applications ?? []);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [upcomingOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const applicationById = new Map(applications.map((app) => [app.id, app]));

  async function schedule(): Promise<void> {
    setError(null);
    setNotice(null);
    if (!form.applicationId || form.round.trim().length === 0) {
      setError('Select an application and name the interview round.');
      return;
    }
    setPending('create');
    try {
      const res = await fetch('/api/owner/talent/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: form.applicationId,
          round: form.round,
          scheduledAt: form.scheduledAt || undefined,
          interviewType: form.interviewType,
          meetingLink: form.meetingLink || undefined,
          interviewer: form.interviewer || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? 'Could not schedule the interview');
        return;
      }
      setForm({ applicationId: '', round: '', scheduledAt: '', interviewType: 'video', meetingLink: '', interviewer: '' });
      setNotice('Interview scheduled.');
      await load();
    } catch {
      setError('Network error');
    } finally {
      setPending(null);
    }
  }

  async function update(id: string, status: string, feedback: string): Promise<void> {
    setError(null);
    setNotice(null);
    setPending(id);
    try {
      const res = await fetch('/api/owner/talent/interviews/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, feedback: feedback || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? 'Could not update the interview');
        return;
      }
      setNotice('Interview updated.');
      await load();
    } catch {
      setError('Network error');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-md border border-red-200 bg-red-500/10 p-3 text-sm text-red-300">{error}</div> : null}
      {notice ? <div className="rounded-md border border-emerald-200 bg-emerald-500/10 p-3 text-sm text-emerald-300">{notice}</div> : null}

      <div className="rounded-xl border border-line bg-navy-surface p-6">
        <h2 className="text-base font-semibold text-ink">Schedule an interview</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={label} htmlFor="interview-application">Application</label>
            <select id="interview-application" className={input + ' mt-2'} value={form.applicationId} onChange={(e) => setForm({ ...form, applicationId: e.target.value })}>
              <option value="">Select an application</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>{app.applicationId + ' - ' + app.candidateCode + ' - ' + app.jobTitle}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="interview-round">Round</label>
            <input id="interview-round" className={input + ' mt-2'} maxLength={80} value={form.round} onChange={(e) => setForm({ ...form, round: e.target.value })} placeholder="e.g. Technical round 1" />
          </div>
          <div>
            <label className={label} htmlFor="interview-when">Scheduled at</label>
            <input id="interview-when" type="datetime-local" className={input + ' mt-2'} value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor="interview-type">Type</label>
            <select id="interview-type" className={input + ' mt-2'} value={form.interviewType} onChange={(e) => setForm({ ...form, interviewType: e.target.value })}>
              {TYPES.map((type) => (<option key={type} value={type}>{type.replace(/_/g, ' ')}</option>))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="interview-link">Meeting link</label>
            <input id="interview-link" className={input + ' mt-2'} value={form.meetingLink} onChange={(e) => setForm({ ...form, meetingLink: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <label className={label} htmlFor="interview-interviewer">Interviewer</label>
            <input id="interview-interviewer" className={input + ' mt-2'} value={form.interviewer} onChange={(e) => setForm({ ...form, interviewer: e.target.value })} />
          </div>
        </div>
        <div className="mt-4">
          <button type="button" onClick={() => void schedule()} disabled={pending !== null} className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50">
            {pending === 'create' ? 'Scheduling...' : 'Schedule interview'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-navy-surface p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-ink">Interview rounds ({interviews.length})</h2>
          <label className="ml-auto flex items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" checked={upcomingOnly} onChange={(e) => setUpcomingOnly(e.target.checked)} className="h-4 w-4 rounded border-line text-accent" />
            Upcoming only
          </label>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              Loading...
            </div>
          ) : null}
        </div>

        {!loading && interviews.length === 0 ? (
          <div className="mt-6 border border-dashed border-line py-12 text-center">
            <p className="text-sm text-slate-400">{upcomingOnly ? 'No upcoming interviews.' : 'No interviews have been scheduled yet.'}</p>
          </div>
        ) : null}

        <div className="mt-4 space-y-4">
          {interviews.map((row) => {
            const app = applicationById.get(row.applicationId);
            return (
              <div key={row.id} className="rounded-lg border border-line p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-ink">{row.round}</span>
                  <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium ' + (statusClasses[row.status] ?? 'bg-slate-800 text-slate-300')}>
                    {row.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-slate-400">{row.interviewType.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-slate-400">{formatWhen(row.scheduledAt)}</span>
                  {app ? (
                    <Link href={'/owner/talent/applications/' + app.id} className="text-xs font-medium text-accent hover:underline">
                      {app.applicationId + ' - ' + app.candidateCode + ' - ' + app.jobTitle}
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400">Application {row.applicationId}</span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-400">
                  {row.interviewer ? <span>Interviewer: {row.interviewer}</span> : null}
                  {row.meetingLink ? (
                    <a href={row.meetingLink} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      Meeting link
                    </a>
                  ) : null}
                </div>
                <InterviewControls row={row} busy={pending === row.id} onSave={update} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function InterviewControls({
  row,
  busy,
  onSave,
}: {
  row: InterviewRow;
  busy: boolean;
  onSave: (id: string, status: string, feedback: string) => Promise<void>;
}) {
  const [status, setStatus] = useState(row.status);
  const [feedback, setFeedback] = useState(row.feedback ?? '');
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <div>
        <label className="block text-xs font-medium text-slate-400" htmlFor={'interview-status-' + row.id}>Status</label>
        <select id={'interview-status-' + row.id} className="mt-1 w-full rounded-md border border-line bg-navy-surface px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((value) => (<option key={value} value={value}>{value.replace(/_/g, ' ')}</option>))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-slate-400" htmlFor={'interview-feedback-' + row.id}>Feedback</label>
        <textarea id={'interview-feedback-' + row.id} rows={2} maxLength={4000} className="mt-1 w-full rounded-md border border-line bg-navy-surface px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
      </div>
      <div className="sm:col-span-3">
        <button type="button" onClick={() => void onSave(row.id, status, feedback)} disabled={busy} className="inline-flex items-center rounded-md border border-line bg-navy-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-slate-800 disabled:opacity-50">
          {busy ? 'Saving...' : 'Save interview'}
        </button>
      </div>
    </div>
  );
}
