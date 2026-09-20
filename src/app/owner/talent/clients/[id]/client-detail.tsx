'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface ClientProfile {
  id: string;
  companyName: string;
  companyWebsite: string | null;
  industry: string | null;
  companyLocation: string | null;
  companySize: string | null;
  contactName: string | null;
  contactDesignation: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  linkedinUrl: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface ClientJob {
  id: string;
  jobId: string;
  title: string;
  status: string;
  openings: number;
  location: string | null;
  createdAt: string;
}

interface ClientApplication {
  id: string;
  applicationId: string;
  candidateCode: string;
  jobId: string;
  jobCode: string;
  jobTitle: string;
  status: string;
  clientSubmissionDate: string | null;
  createdAt: string;
}

interface ClientInterview {
  id: string;
  applicationId: string;
  round: string;
  scheduledAt: string | null;
  status: string;
}

interface ClientPlacement {
  id: string;
  applicationId: string;
  feeAmountMinor: number | null;
  paymentStatus: string;
  joiningDate: string | null;
  paymentDueDate: string | null;
}

const STATUSES = [
  'PROSPECT',
  'CONTACTED',
  'REPLIED',
  'CALL_SCHEDULED',
  'REQUIREMENT_RECEIVED',
  'ACTIVE_CLIENT',
  'FUTURE',
  'NOT_INTERESTED',
] as const;

const statusClasses: Record<string, string> = {
  PROSPECT: 'bg-slate-100 text-slate-700',
  CONTACTED: 'bg-blue-100 text-blue-700',
  REPLIED: 'bg-emerald-100 text-emerald-700',
  CALL_SCHEDULED: 'bg-amber-100 text-amber-700',
  REQUIREMENT_RECEIVED: 'bg-violet-100 text-violet-700',
  ACTIVE_CLIENT: 'bg-green-100 text-green-700',
  FUTURE: 'bg-slate-200 text-slate-600',
  NOT_INTERESTED: 'bg-red-100 text-red-700',
};

const input = 'w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none';
const label = 'block text-sm font-medium text-slate-700';
const dt = 'text-xs font-medium uppercase tracking-wide text-slate-500';
const dd = 'mt-1 text-sm text-ink';

function formatINR(minor: number | null): string {
  if (minor === null) return 'Not calculated';
  return 'INR ' + Math.round(minor / 100).toLocaleString('en-IN');
}

function formatDate(value: string | null): string {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN');
}

export function OwnerClientDetailClient({ clientId }: { clientId: string }) {
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [jobs, setJobs] = useState<ClientJob[]>([]);
  const [applications, setApplications] = useState<ClientApplication[]>([]);
  const [interviews, setInterviews] = useState<ClientInterview[]>([]);
  const [placements, setPlacements] = useState<ClientPlacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    companyName: '',
    companyWebsite: '',
    industry: '',
    companyLocation: '',
    companySize: '',
    contactName: '',
    contactDesignation: '',
    contactEmail: '',
    contactPhone: '',
    linkedinUrl: '',
    status: 'PROSPECT',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clientRes, jobRes, applicationRes, interviewRes, placementRes] = await Promise.all([
        fetch('/api/owner/talent/clients/' + clientId),
        fetch('/api/owner/talent/jobs?clientId=' + clientId + '&limit=200'),
        fetch('/api/owner/talent/applications?limit=200'),
        fetch('/api/owner/talent/interviews?limit=200'),
        fetch('/api/owner/talent/placements?clientId=' + clientId + '&limit=200'),
      ]);

      const clientJson = await clientRes.json();
      if (!clientRes.ok || !clientJson.success) {
        setError(clientJson?.error?.message ?? 'Failed to load client');
        return;
      }
      const profile: ClientProfile = clientJson.data.client;
      setClient(profile);
      setForm({
        companyName: profile.companyName,
        companyWebsite: profile.companyWebsite ?? '',
        industry: profile.industry ?? '',
        companyLocation: profile.companyLocation ?? '',
        companySize: profile.companySize ?? '',
        contactName: profile.contactName ?? '',
        contactDesignation: profile.contactDesignation ?? '',
        contactEmail: profile.contactEmail ?? '',
        contactPhone: profile.contactPhone ?? '',
        linkedinUrl: profile.linkedinUrl ?? '',
        status: profile.status,
        notes: profile.notes ?? '',
      });

      const jobJson = await jobRes.json();
      const clientJobs: ClientJob[] = jobRes.ok && jobJson.success ? jobJson.data.jobs ?? [] : [];
      setJobs(clientJobs);
      const jobIds = new Set(clientJobs.map((job) => job.id));

      const applicationJson = await applicationRes.json();
      const allApplications: ClientApplication[] =
        applicationRes.ok && applicationJson.success ? applicationJson.data.applications ?? [] : [];
      const clientApplications = allApplications.filter((app) => jobIds.has(app.jobId));
      setApplications(clientApplications);
      const applicationIds = new Set(clientApplications.map((app) => app.id));

      const interviewJson = await interviewRes.json();
      const allInterviews: ClientInterview[] =
        interviewRes.ok && interviewJson.success ? interviewJson.data.interviews ?? [] : [];
      setInterviews(allInterviews.filter((row) => applicationIds.has(row.applicationId)));

      const placementJson = await placementRes.json();
      setPlacements(placementRes.ok && placementJson.success ? placementJson.data.placements ?? [] : []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(): Promise<void> {
    setError(null);
    setNotice(null);
    if (form.companyName.trim().length < 2) {
      setError('Enter the company name.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/owner/talent/clients/' + clientId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: form.companyName,
          companyWebsite: form.companyWebsite || undefined,
          industry: form.industry || undefined,
          companyLocation: form.companyLocation || undefined,
          companySize: form.companySize || undefined,
          contactName: form.contactName || undefined,
          contactDesignation: form.contactDesignation || undefined,
          contactEmail: form.contactEmail || undefined,
          contactPhone: form.contactPhone || undefined,
          linkedinUrl: form.linkedinUrl || undefined,
          status: form.status,
          notes: form.notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? 'Could not save the client');
        return;
      }
      setClient(json.data.client);
      setEditOpen(false);
      setNotice('Client updated.');
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-line bg-white p-6">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          Loading client...
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error ?? 'Client not found.'}
      </div>
    );
  }

  let pendingMinor = 0;
  let paidMinor = 0;
  for (const row of placements) {
    const amount = row.feeAmountMinor ?? 0;
    if (row.paymentStatus === 'PAID') paidMinor += amount;
    else if (row.paymentStatus !== 'WAIVED') pendingMinor += amount;
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div> : null}

      <div className="rounded-xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">{client.companyName}</h2>
            <p className="mt-1 text-xs text-slate-500">Added {formatDate(client.createdAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium ' + (statusClasses[client.status] ?? 'bg-slate-100 text-slate-700')}>
              {client.status.replace(/_/g, ' ')}
            </span>
            <button
              type="button"
              onClick={() => setEditOpen((prev) => !prev)}
              className="inline-flex items-center rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-slate-50"
            >
              {editOpen ? 'Close editor' : 'Edit client'}
            </button>
          </div>
        </div>

        {editOpen ? (
          <div className="mt-6 border-t border-line pt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className={label} htmlFor="edit-company">Company name *</label>
                <input id="edit-company" maxLength={200} className={input + ' mt-2'} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="edit-website">Website</label>
                <input id="edit-website" className={input + ' mt-2'} value={form.companyWebsite} onChange={(e) => setForm({ ...form, companyWebsite: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="edit-industry">Industry</label>
                <input id="edit-industry" maxLength={120} className={input + ' mt-2'} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="edit-location">Location</label>
                <input id="edit-location" maxLength={160} className={input + ' mt-2'} value={form.companyLocation} onChange={(e) => setForm({ ...form, companyLocation: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="edit-size">Company size</label>
                <input id="edit-size" maxLength={60} className={input + ' mt-2'} value={form.companySize} onChange={(e) => setForm({ ...form, companySize: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="edit-status">Status</label>
                <select id="edit-status" className={input + ' mt-2'} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map((value) => (<option key={value} value={value}>{value.replace(/_/g, ' ')}</option>))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="edit-contact">Contact name</label>
                <input id="edit-contact" maxLength={120} className={input + ' mt-2'} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="edit-designation">Designation</label>
                <input id="edit-designation" maxLength={120} className={input + ' mt-2'} value={form.contactDesignation} onChange={(e) => setForm({ ...form, contactDesignation: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="edit-email">Contact email</label>
                <input id="edit-email" type="email" className={input + ' mt-2'} value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="edit-phone">Contact phone</label>
                <input id="edit-phone" maxLength={24} className={input + ' mt-2'} value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="edit-linkedin">LinkedIn</label>
                <input id="edit-linkedin" className={input + ' mt-2'} value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className={label} htmlFor="edit-notes">Notes</label>
                <textarea id="edit-notes" rows={3} maxLength={4000} className={input + ' mt-2'} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              <button type="button" onClick={() => setEditOpen(false)} className="inline-flex items-center rounded-md border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className={dt}>Industry</dt><dd className={dd}>{client.industry ?? 'Not recorded'}</dd></div>
          <div><dt className={dt}>Location</dt><dd className={dd}>{client.companyLocation ?? 'Not recorded'}</dd></div>
          <div><dt className={dt}>Company size</dt><dd className={dd}>{client.companySize ?? 'Not recorded'}</dd></div>
          <div><dt className={dt}>Contact</dt><dd className={dd}>{client.contactName ?? 'Not recorded'}{client.contactDesignation ? ' - ' + client.contactDesignation : ''}</dd></div>
          <div><dt className={dt}>Contact email</dt><dd className={dd}>{client.contactEmail ?? 'Not recorded'}</dd></div>
          <div><dt className={dt}>Contact phone</dt><dd className={dd}>{client.contactPhone ?? 'Not recorded'}</dd></div>
          <div><dt className={dt}>Website</dt><dd className={dd}>{client.companyWebsite ?? 'Not recorded'}</dd></div>
          <div><dt className={dt}>LinkedIn</dt><dd className={dd}>{client.linkedinUrl ?? 'Not recorded'}</dd></div>
          <div><dt className={dt}>Notes</dt><dd className={dd}>{client.notes ?? 'No notes'}</dd></div>
        </dl>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-line bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Requirements</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{jobs.length}</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Submitted</p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {applications.filter((app) => app.clientSubmissionDate !== null).length}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pending fees</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatINR(pendingMinor)}</p>
        </div>
        <div className="rounded-lg border border-line bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Paid revenue</p>
          <p className="mt-1 text-2xl font-semibold text-accent">{formatINR(paidMinor)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-base font-semibold text-ink">Requirements ({jobs.length})</h2>
        {jobs.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No job requirements are linked to this client yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {jobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Link href={'/owner/talent/jobs/' + job.id} className="text-sm font-medium text-accent hover:underline">{job.title}</Link>
                <span className="text-xs text-slate-500">{job.jobId}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">{job.status}</span>
                <span className="text-xs text-slate-500">{job.openings} opening{job.openings === 1 ? '' : 's'}</span>
                {job.location ? <span className="text-xs text-slate-500">{job.location}</span> : null}
                <span className="ml-auto text-xs text-slate-400">{formatDate(job.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-base font-semibold text-ink">Candidate pipeline ({applications.length})</h2>
        {applications.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No candidates are linked to this client yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {applications.map((app) => (
              <li key={app.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Link href={'/owner/talent/applications/' + app.id} className="text-sm font-medium text-accent hover:underline">{app.applicationId}</Link>
                <span className="text-xs text-slate-500">{app.candidateCode}</span>
                <span className="text-sm text-ink">{app.jobTitle}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">{app.status.replace(/_/g, ' ')}</span>
                <span className="text-xs text-slate-500">
                  {app.clientSubmissionDate ? 'Submitted ' + formatDate(app.clientSubmissionDate) : 'Not submitted to client'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-base font-semibold text-ink">Interviews ({interviews.length})</h2>
        {interviews.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No interviews recorded for this client.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {interviews.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="text-sm text-ink">{row.round}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">{row.status.replace(/_/g, ' ')}</span>
                <span className="text-xs text-slate-500">{formatDate(row.scheduledAt)}</span>
                <Link href={'/owner/talent/applications/' + row.applicationId} className="ml-auto text-xs font-medium text-accent hover:underline">
                  View application
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-base font-semibold text-ink">Placements and fees ({placements.length})</h2>
        {placements.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No placements recorded for this client yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {placements.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Link href={'/owner/talent/applications/' + row.applicationId} className="text-sm font-medium text-accent hover:underline">View application</Link>
                <span className="text-sm text-ink">{formatINR(row.feeAmountMinor)}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">{row.paymentStatus.replace(/_/g, ' ')}</span>
                <span className="text-xs text-slate-500">Joining {formatDate(row.joiningDate)}</span>
                <span className="text-xs text-slate-500">Due {formatDate(row.paymentDueDate)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
