'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ApplicationDetailProps {
  application: {
    id: string;
    applicationId: string;
    candidateId: string;
    candidateCode: string;
    jobId: string;
    jobCode: string;
    jobTitle: string;
    source: string;
    status: string;
    recruiterNotes: string | null;
    screeningNotes: string | null;
    clientSubmissionDate: string | null;
    createdAt: string;
    updatedAt: string;
  };
  nextStatuses: string[];
  pipeline: string[];
}

const statusClasses: Record<string, string> = {
  NEW: 'bg-slate-800 text-slate-300',
  SCREENING: 'bg-blue-100 text-blue-700',
  CONTACTED: 'bg-purple-100 text-purple-700',
  INTERESTED: 'bg-indigo-100 text-indigo-700',
  SHORTLISTED: 'bg-emerald-500/100/15 text-emerald-300',
  CLIENT_SUBMITTED: 'bg-cyan-100 text-cyan-700',
  INTERVIEW: 'bg-amber-500/100/15 text-amber-300',
  SELECTED: 'bg-blue-100 text-blue-700',
  OFFER: 'bg-violet-100 text-violet-700',
  JOINED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-500/100/15 text-red-300',
  WITHDRAWN: 'bg-slate-800 text-slate-300',
  NO_RESPONSE: 'bg-slate-800 text-slate-300',
  ON_HOLD: 'bg-yellow-100 text-yellow-700',
};

/** CLIENT_SUBMITTED is the transition the server refuses unless the pipeline is ready. */
const GUARDED = new Set(['CLIENT_SUBMITTED']);

const dt = 'text-xs font-medium uppercase tracking-wide text-slate-400';
const dd = 'mt-1 text-sm text-ink';

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString('en-IN');
}

export default function ApplicationDetail({ application, nextStatuses, pipeline }: ApplicationDetailProps) {
  const [status, setStatus] = useState(application.status);
  const [recruiterNotes, setRecruiterNotes] = useState(application.recruiterNotes ?? '');
  const [screeningNotes, setScreeningNotes] = useState(application.screeningNotes ?? '');
  const [clientSubmissionDate, setClientSubmissionDate] = useState(application.clientSubmissionDate);
  const [available, setAvailable] = useState<string[]>(nextStatuses);
  const [pending, setPending] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const currentIndex = pipeline.indexOf(status);
  const confirmationReached = status === 'CONTACTED' || status === 'INTERESTED' || (currentIndex > pipeline.indexOf('INTERESTED') && currentIndex !== -1);

  async function applyStatus(target: string): Promise<void> {
    if (GUARDED.has(target)) {
      const ok = window.confirm(
        'Submit this candidate to the client? This is recorded against the client relationship. The server will refuse the change unless the candidate has been contacted and confirmed.'
      );
      if (!ok) return;
    }
    setPending(target);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/owner/talent/applications/' + application.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: target }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? 'Could not update the application status');
        return;
      }
      const updated = json.data.application;
      setStatus(updated.status);
      setClientSubmissionDate(updated.clientSubmissionDate ?? null);
      setRecruiterNotes(updated.recruiterNotes ?? recruiterNotes);
      setScreeningNotes(updated.screeningNotes ?? screeningNotes);
      setAvailable([]);
      setNotice('Status updated to ' + updated.status.replace(/_/g, ' ') + '. Reload to see the new allowed transitions.');
    } catch {
      setError('Network error');
    } finally {
      setPending(null);
    }
  }

  async function saveNotes(): Promise<void> {
    setSavingNotes(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/owner/talent/applications/' + application.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recruiterNotes: recruiterNotes.trim().length > 0 ? recruiterNotes.trim() : undefined,
          screeningNotes: screeningNotes.trim().length > 0 ? screeningNotes.trim() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? 'Could not save notes');
        return;
      }
      setNotice('Notes saved. Recruiter and screening notes are Owner-only.');
    } catch {
      setError('Network error');
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-md border border-red-200 bg-red-500/10 p-3 text-sm text-red-300">{error}</div> : null}
      {notice ? <div className="rounded-md border border-emerald-200 bg-emerald-500/10 p-3 text-sm text-emerald-300">{notice}</div> : null}

      <div className="rounded-xl border border-line bg-navy-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">{application.jobTitle}</h2>
            <p className="mt-1 text-xs text-slate-400">{application.jobCode}</p>
          </div>
          <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium ' + (statusClasses[status] ?? 'bg-slate-800 text-slate-300')}>
            {status.replace(/_/g, ' ')}
          </span>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className={dt}>Application</dt><dd className={dd}>{application.applicationId}</dd></div>
          <div><dt className={dt}>Candidate</dt><dd className={dd}>{application.candidateCode}</dd></div>
          <div><dt className={dt}>Source</dt><dd className={dd}>{application.source.replace(/_/g, ' ')}</dd></div>
          <div><dt className={dt}>Applied</dt><dd className={dd}>{formatDate(application.createdAt)}</dd></div>
          <div><dt className={dt}>Last updated</dt><dd className={dd}>{formatDate(application.updatedAt)}</dd></div>
          <div><dt className={dt}>Client submission</dt><dd className={dd}>{clientSubmissionDate ? formatDate(clientSubmissionDate) : 'Not submitted'}</dd></div>
        </dl>

        <div className="mt-6">
          <h3 className={dt}>Candidate confirmation</h3>
          <p className="mt-1 text-sm text-slate-400">
            {confirmationReached
              ? 'The candidate has been reached through the pipeline. Client submission is permitted once the application is SHORTLISTED.'
              : 'The candidate has not reached the CONTACTED stage yet, so client submission is blocked on the server.'}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={'/owner/talent/candidates/' + application.candidateId} className="inline-flex items-center rounded-md border border-line bg-navy-surface px-4 py-2 text-sm font-medium text-ink shadow-sm transition hover:bg-slate-800">
            View candidate
          </Link>
          <Link href={'/owner/talent/jobs/' + application.jobId} className="inline-flex items-center rounded-md border border-line bg-navy-surface px-4 py-2 text-sm font-medium text-ink shadow-sm transition hover:bg-slate-800">
            View job
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-navy-surface p-6">
        <h2 className="text-base font-semibold text-ink">Pipeline</h2>
        <ol className="mt-4 flex flex-wrap gap-2">
          {pipeline.map((stage, index) => {
            const isCurrent = stage === status;
            const isPast = currentIndex !== -1 && index < currentIndex;
            return (
              <li
                key={stage}
                className={
                  'rounded-full px-3 py-1 text-xs font-medium ' +
                  (isCurrent
                    ? 'bg-accent text-white'
                    : isPast
                      ? 'bg-emerald-500/100/15 text-emerald-300'
                      : 'bg-slate-800 text-slate-400')
                }
              >
                {stage.replace(/_/g, ' ')}
              </li>
            );
          })}
        </ol>
        {['REJECTED', 'WITHDRAWN', 'NO_RESPONSE', 'ON_HOLD'].includes(status) ? (
          <p className="mt-3 text-sm text-slate-400">This application is currently {status.replace(/_/g, ' ').toLowerCase()}.</p>
        ) : null}

        <h3 className="mt-6 text-sm font-medium text-ink">Allowed next steps</h3>
        {available.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">
            No further transitions are available from this stage. Reload the page if the status changed elsewhere.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {available.map((target) => (
              <button
                key={target}
                type="button"
                onClick={() => void applyStatus(target)}
                disabled={pending !== null}
                className={
                  'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-white shadow-sm transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ' +
                  (GUARDED.has(target) ? 'bg-cyan-700 hover:bg-cyan-800' : 'bg-slate-700 hover:bg-slate-800')
                }
              >
                {pending === target ? 'Working...' : 'Move to ' + target.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-400">
          The pipeline is enforced server-side: CLIENT_SUBMITTED can only be reached from SHORTLISTED, and only after the
          candidate has been contacted and has confirmed interest.
        </p>
      </div>

      <div className="rounded-xl border border-line bg-navy-surface p-6">
        <h2 className="text-base font-semibold text-ink">Internal notes</h2>
        <p className="mt-1 text-xs text-slate-400">Owner-only. Never shown to candidates or clients.</p>
        <label className="mt-4 block text-sm font-medium text-slate-300" htmlFor="recruiterNotes">
          Recruiter notes
        </label>
        <textarea
          id="recruiterNotes"
          rows={4}
          maxLength={4000}
          value={recruiterNotes}
          onChange={(e) => setRecruiterNotes(e.target.value)}
          className="mt-2 w-full rounded-md border border-line bg-navy-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
        />
        <label className="mt-4 block text-sm font-medium text-slate-300" htmlFor="screeningNotes">
          Screening notes
        </label>
        <textarea
          id="screeningNotes"
          rows={4}
          maxLength={4000}
          value={screeningNotes}
          onChange={(e) => setScreeningNotes(e.target.value)}
          className="mt-2 w-full rounded-md border border-line bg-navy-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
        />
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void saveNotes()}
            disabled={savingNotes}
            className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50"
          >
            {savingNotes ? 'Saving...' : 'Save notes'}
          </button>
        </div>
      </div>
    </div>
  );
}
