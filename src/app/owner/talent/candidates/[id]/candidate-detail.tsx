'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface CandidateProfile {
  id: string;
  candidateId: string;
  fullName: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  currentLocation: string | null;
  preferredLocation: string | null;
  totalExperience: number | null;
  relevantExperience: number | null;
  currentCompany: string | null;
  currentCtc: number | null;
  expectedCtc: number | null;
  noticePeriod: string | null;
  highestQualification: string | null;
  skills: string[];
  linkedinUrl: string | null;
  preferredWorkMode: string | null;
  shiftPreference: string | null;
  relocationPreference: string | null;
  source: string;
  consentStatus: string;
  internalNotes: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CandidateApplicationSummary {
  id: string;
  applicationId: string;
  jobId: string;
  jobCode: string;
  jobTitle: string;
  status: string;
  source: string;
  clientSubmissionDate: string | null;
  createdAt: string;
}

interface CandidateDocument {
  id: string;
  kind: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  uploadedAt: string;
}

interface CandidateResponse {
  success: boolean;
  data?: { candidate: CandidateProfile; documents: CandidateDocument[]; applications: CandidateApplicationSummary[] };
  error?: { message?: string };
}

const statusClasses: Record<string, string> = {
  granted: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  declined: 'bg-red-100 text-red-700',
};

const chip = 'rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700';
const dt = 'text-xs font-medium uppercase tracking-wide text-slate-500';
const dd = 'mt-1 text-sm text-ink';

function rupees(value: number | null): string {
  if (value === null) return 'Not provided';
  return 'INR ' + value.toLocaleString('en-IN');
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN');
}

export function OwnerCandidateDetailClient({ candidateId }: { candidateId: string }) {
  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [documents, setDocuments] = useState<CandidateDocument[]>([]);
  const [applications, setApplications] = useState<CandidateApplicationSummary[]>([]);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/owner/talent/candidates/' + candidateId);
      const json: CandidateResponse = await res.json();
      if (!res.ok || !json.success || !json.data) {
        setError(json?.error?.message ?? 'Failed to load candidate');
        return;
      }
      setCandidate(json.data.candidate);
      setDocuments(json.data.documents ?? []);
      setApplications(json.data.applications ?? []);
      setNotes(json.data.candidate.internalNotes ?? '');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveNotes(): Promise<void> {
    setSavingNotes(true);
    setNotice(null);
    try {
      const res = await fetch('/api/owner/talent/candidates/' + candidateId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internalNotes: notes.trim().length > 0 ? notes.trim() : null }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? 'Could not save notes');
        return;
      }
      setNotice('Internal notes saved. These are never shown to the candidate or to clients.');
    } catch {
      setError('Network error');
    } finally {
      setSavingNotes(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-line bg-white p-6">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          Loading candidate...
        </div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error ?? 'Candidate not found.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div> : null}

      <div className="rounded-xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">{candidate.fullName}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {candidate.candidateId} - added {formatDate(candidate.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium ' + (statusClasses[candidate.consentStatus] ?? 'bg-slate-100 text-slate-700')}>
              Consent: {candidate.consentStatus}
            </span>
            <span className={chip}>Source: {candidate.source}</span>
            {candidate.archived ? <span className={chip}>Archived</span> : null}
          </div>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className={dt}>Email</dt><dd className={dd}>{candidate.email}</dd></div>
          <div><dt className={dt}>Phone</dt><dd className={dd}>{candidate.phone ?? 'Not provided'}</dd></div>
          <div><dt className={dt}>WhatsApp</dt><dd className={dd}>{candidate.whatsapp ?? 'Not provided'}</dd></div>
          <div><dt className={dt}>Current location</dt><dd className={dd}>{candidate.currentLocation ?? 'Not provided'}</dd></div>
          <div><dt className={dt}>Preferred location</dt><dd className={dd}>{candidate.preferredLocation ?? 'Not provided'}</dd></div>
          <div><dt className={dt}>Relocation</dt><dd className={dd}>{candidate.relocationPreference ?? 'Not provided'}</dd></div>
          <div><dt className={dt}>Total experience</dt><dd className={dd}>{candidate.totalExperience != null ? candidate.totalExperience + ' years' : 'Not provided'}</dd></div>
          <div><dt className={dt}>Relevant experience</dt><dd className={dd}>{candidate.relevantExperience != null ? candidate.relevantExperience + ' years' : 'Not provided'}</dd></div>
          <div><dt className={dt}>Current company</dt><dd className={dd}>{candidate.currentCompany ?? 'Not provided'}</dd></div>
          <div><dt className={dt}>Current CTC</dt><dd className={dd}>{rupees(candidate.currentCtc)}</dd></div>
          <div><dt className={dt}>Expected CTC</dt><dd className={dd}>{rupees(candidate.expectedCtc)}</dd></div>
          <div><dt className={dt}>Notice period</dt><dd className={dd}>{candidate.noticePeriod ?? 'Not provided'}</dd></div>
          <div><dt className={dt}>Qualification</dt><dd className={dd}>{candidate.highestQualification ?? 'Not provided'}</dd></div>
          <div><dt className={dt}>Preferred work mode</dt><dd className={dd}>{candidate.preferredWorkMode ?? 'Not provided'}</dd></div>
          <div><dt className={dt}>Shift preference</dt><dd className={dd}>{candidate.shiftPreference ?? 'Not provided'}</dd></div>
        </dl>

        {candidate.skills.length > 0 ? (
          <div className="mt-6">
            <h3 className={dt}>Skills</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {candidate.skills.map((skill) => (<span key={skill} className={chip}>{skill}</span>))}
            </div>
          </div>
        ) : null}

        {candidate.linkedinUrl ? (
          <div className="mt-6">
            <h3 className={dt}>LinkedIn</h3>
            <p className="mt-1 break-all text-sm text-accent">{candidate.linkedinUrl}</p>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-base font-semibold text-ink">Internal recruiter notes</h2>
        <p className="mt-1 text-xs text-slate-500">Owner-only. Never exposed on public routes or to clients.</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          maxLength={4000}
          aria-label="Internal recruiter notes"
          className="mt-3 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
        />
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void saveNotes()}
            disabled={savingNotes}
            className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
          >
            {savingNotes ? 'Saving...' : 'Save notes'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-base font-semibold text-ink">Documents ({documents.length})</h2>
        <p className="mt-1 text-xs text-slate-500">
          Downloads are served through the authenticated Owner endpoint and every access is written to the talent activity log.
        </p>
        {documents.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No documents uploaded for this candidate.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="text-sm text-ink">{doc.filename}</span>
                <span className={chip}>{doc.kind}</span>
                <span className="text-xs text-slate-500">{Math.max(1, Math.round(doc.byteSize / 1024))} KB</span>
                <span className="text-xs text-slate-400">{formatDate(doc.uploadedAt)}</span>
                <a
                  href={'/api/owner/talent/documents/' + doc.id}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto rounded-md px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10"
                >
                  View document
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-base font-semibold text-ink">Applications ({applications.length})</h2>
        {applications.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">This candidate has no applications yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {applications.map((app) => (
              <li key={app.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Link href={'/owner/talent/applications/' + app.id} className="text-sm font-medium text-accent hover:underline">
                  {app.applicationId}
                </Link>
                <span className="text-sm text-ink">{app.jobTitle}</span>
                <span className="text-xs text-slate-500">{app.jobCode}</span>
                <span className={chip}>{app.status}</span>
                {app.clientSubmissionDate ? (
                  <span className="text-xs text-slate-500">Client submission: {formatDate(app.clientSubmissionDate)}</span>
                ) : null}
                <span className="ml-auto text-xs text-slate-400">{formatDate(app.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
