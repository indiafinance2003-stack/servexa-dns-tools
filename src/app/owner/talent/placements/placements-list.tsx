'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface PlacementRow {
  id: string;
  applicationId: string;
  candidateId: string;
  clientId: string | null;
  jobId: string | null;
  placementDate: string | null;
  joiningDate: string | null;
  annualCtcMinor: number | null;
  feeType: string;
  feePercentageBps: number | null;
  fixedFeeMinor: number | null;
  feeAmountMinor: number | null;
  paymentStatus: string;
  paymentDueDate: string | null;
  replacementPeriodDays: number | null;
  replacementUntil: string | null;
  notes: string | null;
  createdAt: string;
}

interface ApplicationRow {
  id: string;
  applicationId: string;
  candidateCode: string;
  jobTitle: string;
  jobCode: string;
}

interface ClientRow {
  id: string;
  companyName: string;
}

const PAYMENT_STATUSES = ['PENDING', 'INVOICED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED'] as const;
const FEE_TYPES = ['percentage', 'fixed', 'hybrid'] as const;

const statusClasses: Record<string, string> = {
  PENDING: 'bg-amber-500/100/15 text-amber-300',
  INVOICED: 'bg-blue-100 text-blue-700',
  PARTIALLY_PAID: 'bg-indigo-100 text-indigo-700',
  PAID: 'bg-emerald-500/100/15 text-emerald-300',
  OVERDUE: 'bg-red-500/100/15 text-red-300',
  WAIVED: 'bg-slate-800 text-slate-300',
};

const input = 'w-full rounded-md border border-line bg-navy-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none';
const label = 'block text-sm font-medium text-slate-300';

/** Money is stored in integer paise and only ever formatted for display. */
function formatINR(minor: number | null): string {
  if (minor === null) return 'Not calculated';
  return 'INR ' + Math.round(minor / 100).toLocaleString('en-IN');
}

function formatPercentFromBps(bps: number | null): string {
  if (bps === null) return 'Not set';
  return (bps / 100).toFixed(bps % 100 === 0 ? 0 : 2) + '%';
}

function formatDate(value: string | null): string {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('en-IN');
}

export function OwnerPlacementsList() {
  const [placements, setPlacements] = useState<PlacementRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const [form, setForm] = useState({
    applicationId: '',
    annualCtc: '',
    feeType: 'percentage',
    feePercentage: '',
    fixedFee: '',
    placementDate: '',
    joiningDate: '',
    paymentDueDate: '',
    replacementPeriodDays: '',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [placementRes, applicationRes, clientRes] = await Promise.all([
        fetch('/api/owner/talent/placements?limit=200'),
        fetch('/api/owner/talent/applications?limit=200'),
        fetch('/api/owner/talent/clients?limit=200'),
      ]);
      const placementJson = await placementRes.json();
      if (!placementRes.ok || !placementJson.success) {
        setError(placementJson?.error?.message ?? 'Failed to load placements');
        return;
      }
      setPlacements(placementJson.data.placements ?? []);
      const applicationJson = await applicationRes.json();
      if (applicationRes.ok && applicationJson.success) {
        setApplications(applicationJson.data.applications ?? []);
      }
      const clientJson = await clientRes.json();
      if (clientRes.ok && clientJson.success) {
        setClients(clientJson.data.clients ?? []);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applicationById = new Map(applications.map((app) => [app.id, app]));
  const clientById = new Map(clients.map((client) => [client.id, client.companyName]));

  let pendingMinor = 0;
  let paidMinor = 0;
  for (const row of placements) {
    const amount = row.feeAmountMinor ?? 0;
    if (row.paymentStatus === 'PAID') paidMinor += amount;
    else if (row.paymentStatus !== 'WAIVED') pendingMinor += amount;
  }

  async function create(): Promise<void> {
    setError(null);
    setNotice(null);
    if (!form.applicationId) {
      setError('Select the application this placement belongs to.');
      return;
    }
    if (form.feeType === 'percentage' && (form.annualCtc === '' || form.feePercentage === '')) {
      setError('A percentage fee needs both the annual CTC and the fee percentage.');
      return;
    }
    setPending('create');
    try {
      const res = await fetch('/api/owner/talent/placements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId: form.applicationId,
          annualCtc: form.annualCtc || undefined,
          feeType: form.feeType,
          feePercentage: form.feePercentage || undefined,
          fixedFee: form.fixedFee || undefined,
          placementDate: form.placementDate || undefined,
          joiningDate: form.joiningDate || undefined,
          paymentDueDate: form.paymentDueDate || undefined,
          replacementPeriodDays: form.replacementPeriodDays || undefined,
          notes: form.notes || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? 'Could not record the placement');
        return;
      }
      setForm({ applicationId: '', annualCtc: '', feeType: 'percentage', feePercentage: '', fixedFee: '', placementDate: '', joiningDate: '', paymentDueDate: '', replacementPeriodDays: '', notes: '' });
      setNotice('Placement recorded.');
      await load();
    } catch {
      setError('Network error');
    } finally {
      setPending(null);
    }
  }

  async function updatePayment(id: string, paymentStatus: string): Promise<void> {
    setError(null);
    setNotice(null);
    setPending(id);
    try {
      const res = await fetch('/api/owner/talent/placements/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentStatus }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json?.error?.message ?? 'Could not update the payment status');
        return;
      }
      setNotice('Payment status updated to ' + paymentStatus.replace(/_/g, ' ') + '.');
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

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-navy-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Placements</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{placements.length}</p>
        </div>
        <div className="rounded-lg border border-line bg-navy-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Pending fees</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{formatINR(pendingMinor)}</p>
        </div>
        <div className="rounded-lg border border-line bg-navy-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Paid revenue</p>
          <p className="mt-1 text-2xl font-semibold text-accent">{formatINR(paidMinor)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-navy-surface p-6">
        <h2 className="text-base font-semibold text-ink">Record a placement</h2>
        <p className="mt-1 text-xs text-slate-400">
          The fee is calculated server-side from the annual CTC and agreed percentage, or from a fixed fee. Recording a
          placement never implies a payment has been received.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={label} htmlFor="placement-application">Application</label>
            <select id="placement-application" className={input + ' mt-2'} value={form.applicationId} onChange={(e) => setForm({ ...form, applicationId: e.target.value })}>
              <option value="">Select an application</option>
              {applications.map((app) => (
                <option key={app.id} value={app.id}>{app.applicationId + ' - ' + app.candidateCode + ' - ' + app.jobTitle}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="placement-ctc">Annual CTC (INR)</label>
            <input id="placement-ctc" type="number" min={0} className={input + ' mt-2'} value={form.annualCtc} onChange={(e) => setForm({ ...form, annualCtc: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor="placement-feetype">Fee type</label>
            <select id="placement-feetype" className={input + ' mt-2'} value={form.feeType} onChange={(e) => setForm({ ...form, feeType: e.target.value })}>
              {FEE_TYPES.map((type) => (<option key={type} value={type}>{type}</option>))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="placement-feepct">Fee percentage</label>
            <input id="placement-feepct" type="number" min={0} max={100} step="0.01" className={input + ' mt-2'} value={form.feePercentage} onChange={(e) => setForm({ ...form, feePercentage: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor="placement-fixed">Fixed fee (INR)</label>
            <input id="placement-fixed" type="number" min={0} className={input + ' mt-2'} value={form.fixedFee} onChange={(e) => setForm({ ...form, fixedFee: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor="placement-date">Placement date</label>
            <input id="placement-date" type="date" className={input + ' mt-2'} value={form.placementDate} onChange={(e) => setForm({ ...form, placementDate: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor="placement-joining">Joining date</label>
            <input id="placement-joining" type="date" className={input + ' mt-2'} value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor="placement-due">Payment due date</label>
            <input id="placement-due" type="date" className={input + ' mt-2'} value={form.paymentDueDate} onChange={(e) => setForm({ ...form, paymentDueDate: e.target.value })} />
          </div>
          <div>
            <label className={label} htmlFor="placement-replacement">Replacement period (days)</label>
            <input id="placement-replacement" type="number" min={0} max={730} className={input + ' mt-2'} value={form.replacementPeriodDays} onChange={(e) => setForm({ ...form, replacementPeriodDays: e.target.value })} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={label} htmlFor="placement-notes">Notes</label>
            <input id="placement-notes" maxLength={4000} className={input + ' mt-2'} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="mt-4">
          <button type="button" onClick={() => void create()} disabled={pending !== null} className="inline-flex items-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-accent/90 disabled:opacity-50">
            {pending === 'create' ? 'Recording...' : 'Record placement'}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-navy-surface p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-ink">Placements ({placements.length})</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              Loading...
            </div>
          ) : null}
        </div>

        {!loading && placements.length === 0 ? (
          <div className="mt-6 border border-dashed border-line py-12 text-center">
            <p className="text-sm text-slate-400">No placements recorded yet.</p>
          </div>
        ) : null}

        <div className="mt-4 space-y-4">
          {placements.map((row) => {
            const app = applicationById.get(row.applicationId);
            return (
              <div key={row.id} className="rounded-lg border border-line p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-ink">{row.feeAmountMinor !== null ? formatINR(row.feeAmountMinor) : 'Fee not calculated'}</span>
                  <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium ' + (statusClasses[row.paymentStatus] ?? 'bg-slate-800 text-slate-300')}>
                    {row.paymentStatus.replace(/_/g, ' ')}
                  </span>
                  {app ? (
                    <Link href={'/owner/talent/applications/' + app.id} className="text-xs font-medium text-accent hover:underline">
                      {app.applicationId + ' - ' + app.candidateCode + ' - ' + app.jobTitle}
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400">Application {row.applicationId}</span>
                  )}
                </div>
                <dl className="mt-3 grid gap-3 text-xs text-slate-400 sm:grid-cols-3 lg:grid-cols-5">
                  <div><dt>Client</dt><dd className="mt-0.5">{row.clientId ? clientById.get(row.clientId) ?? 'Unknown client' : 'Not linked'}</dd></div>
                  <div><dt>Annual CTC</dt><dd className="mt-0.5">{formatINR(row.annualCtcMinor)}</dd></div>
                  <div><dt>Fee type</dt><dd className="mt-0.5">{row.feeType}</dd></div>
                  <div><dt>Fee percentage</dt><dd className="mt-0.5">{formatPercentFromBps(row.feePercentageBps)}</dd></div>
                  <div><dt>Fixed fee</dt><dd className="mt-0.5">{formatINR(row.fixedFeeMinor)}</dd></div>
                  <div><dt>Placement date</dt><dd className="mt-0.5">{formatDate(row.placementDate)}</dd></div>
                  <div><dt>Joining date</dt><dd className="mt-0.5">{formatDate(row.joiningDate)}</dd></div>
                  <div><dt>Payment due</dt><dd className="mt-0.5">{formatDate(row.paymentDueDate)}</dd></div>
                  <div><dt>Replacement period</dt><dd className="mt-0.5">{row.replacementPeriodDays !== null ? row.replacementPeriodDays + ' days' : 'Not set'}</dd></div>
                  <div><dt>Replacement until</dt><dd className="mt-0.5">{formatDate(row.replacementUntil)}</dd></div>
                </dl>
                {row.notes ? <p className="mt-2 text-xs text-slate-400">{row.notes}</p> : null}
                <PaymentControl row={row} busy={pending === row.id} onSave={updatePayment} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PaymentControl({ row, busy, onSave }: { row: PlacementRow; busy: boolean; onSave: (id: string, paymentStatus: string) => Promise<void> }) {
  const [value, setValue] = useState(row.paymentStatus);
  return (
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs font-medium text-slate-400" htmlFor={'placement-payment-' + row.id}>Payment status</label>
        <select
          id={'placement-payment-' + row.id}
          className="mt-1 w-48 rounded-md border border-line bg-navy-surface px-3 py-1.5 text-sm text-ink focus:border-accent focus:outline-none"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          {PAYMENT_STATUSES.map((status) => (<option key={status} value={status}>{status.replace(/_/g, ' ')}</option>))}
        </select>
      </div>
      <button type="button" onClick={() => void onSave(row.id, value)} disabled={busy} className="inline-flex items-center rounded-md border border-line bg-navy-surface px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-slate-800 disabled:opacity-50">
        {busy ? 'Saving...' : 'Save payment status'}
      </button>
    </div>
  );
}
