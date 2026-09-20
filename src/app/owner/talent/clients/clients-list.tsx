'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface ClientRow {
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
  status: string;
  notes: string | null;
  createdAt: string;
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

const emptyForm = {
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
};

export function OwnerClientsList() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (status) params.set('status', status);
      params.set('limit', '200');
      const res = await fetch('/api/owner/talent/clients?' + params.toString());
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? 'Failed to load clients');
        return;
      }
      setClients(json.data.clients ?? []);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(): Promise<void> {
    setError(null);
    setNotice(null);
    if (form.companyName.trim().length < 2) {
      setError('Enter the company name.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/owner/talent/clients', {
        method: 'POST',
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
        setError(json?.error?.message ?? 'Could not create the client');
        return;
      }
      setForm(emptyForm);
      setShowForm(false);
      setNotice('Client created.');
      await load();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div> : null}

      <div className="rounded-xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            aria-label="Search clients"
            placeholder="Search company, contact, email..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-64 rounded-md border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent focus:outline-none"
          />
          <select
            aria-label="Filter by client status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-52 rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="">All statuses</option>
            {STATUSES.map((value) => (<option key={value} value={value}>{value.replace(/_/g, ' ')}</option>))}
          </select>
          <span className="text-xs text-slate-500">{clients.length} shown</span>
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="ml-auto inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent/90"
          >
            {showForm ? 'Close form' : 'New client'}
          </button>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              Loading...
            </div>
          ) : null}
        </div>

        {showForm ? (
          <div className="mt-6 border-t border-line pt-6">
            <h2 className="text-base font-semibold text-ink">Add a client</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className={label} htmlFor="client-company">Company name *</label>
                <input id="client-company" maxLength={200} className={input + ' mt-2'} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="client-website">Website</label>
                <input id="client-website" className={input + ' mt-2'} placeholder="https://..." value={form.companyWebsite} onChange={(e) => setForm({ ...form, companyWebsite: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="client-industry">Industry</label>
                <input id="client-industry" maxLength={120} className={input + ' mt-2'} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="client-location">Location</label>
                <input id="client-location" maxLength={160} className={input + ' mt-2'} value={form.companyLocation} onChange={(e) => setForm({ ...form, companyLocation: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="client-size">Company size</label>
                <input id="client-size" maxLength={60} className={input + ' mt-2'} placeholder="e.g. 50-200" value={form.companySize} onChange={(e) => setForm({ ...form, companySize: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="client-status">Status</label>
                <select id="client-status" className={input + ' mt-2'} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUSES.map((value) => (<option key={value} value={value}>{value.replace(/_/g, ' ')}</option>))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="client-contact">Contact name</label>
                <input id="client-contact" maxLength={120} className={input + ' mt-2'} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="client-designation">Designation</label>
                <input id="client-designation" maxLength={120} className={input + ' mt-2'} value={form.contactDesignation} onChange={(e) => setForm({ ...form, contactDesignation: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="client-email">Contact email</label>
                <input id="client-email" type="email" className={input + ' mt-2'} value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="client-phone">Contact phone</label>
                <input id="client-phone" maxLength={24} className={input + ' mt-2'} value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
              </div>
              <div>
                <label className={label} htmlFor="client-linkedin">LinkedIn</label>
                <input id="client-linkedin" className={input + ' mt-2'} placeholder="https://..." value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className={label} htmlFor="client-notes">Notes</label>
                <textarea id="client-notes" rows={3} maxLength={4000} className={input + ' mt-2'} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={() => void create()} disabled={saving} className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50">
                {saving ? 'Saving...' : 'Create client'}
              </button>
              <button type="button" onClick={() => { setForm(emptyForm); setShowForm(false); }} className="inline-flex items-center rounded-md border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-base font-semibold text-ink">Client list ({clients.length})</h2>
        {!loading && clients.length === 0 ? (
          <div className="mt-6 border border-dashed border-line py-12 text-center">
            <p className="text-sm text-slate-500">
              {query || status ? 'No clients match these filters.' : 'No clients yet. Add the first employer relationship.'}
            </p>
          </div>
        ) : null}
        <div className="mt-4 divide-y divide-line">
          {clients.map((client) => (
            <div key={client.id} className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0">
              <Link href={'/owner/talent/clients/' + client.id} className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-ink">{client.companyName}</p>
                <p className="text-xs text-slate-500">
                  {[client.industry, client.companyLocation, client.companySize].filter(Boolean).join(' - ') || 'No details recorded'}
                </p>
              </Link>
              <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium ' + (statusClasses[client.status] ?? 'bg-slate-100 text-slate-700')}>
                {client.status.replace(/_/g, ' ')}
              </span>
              {client.contactName ? <span className="text-xs text-slate-500">{client.contactName}</span> : null}
              {client.contactEmail ? <span className="text-xs text-slate-500">{client.contactEmail}</span> : null}
              <Link href={'/owner/talent/clients/' + client.id} className="rounded-md px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10">
                View
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
