'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiPost, formatApiError } from '@/lib/client/api';
import { DNSLookupResult, DNSLookupStatus, DNSRecordType } from '@/types/domain';
import { buildRecordRows, buildSoaFields, DnsRecordRow } from '@/lib/client/dns-records';

const RECORD_TYPES = Object.values(DNSRecordType);

const STATUS_STYLES: Record<DNSLookupStatus, string> = {
  success: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  empty: 'bg-amber-50 text-amber-900 ring-amber-300',
  nxdomain: 'bg-red-50 text-red-900 ring-red-300',
  servfail: 'bg-red-50 text-red-900 ring-red-300',
  refused: 'bg-red-50 text-red-900 ring-red-300',
  timeout: 'bg-red-50 text-red-900 ring-red-300',
  error: 'bg-red-50 text-red-900 ring-red-300',
};

const STATUS_LABELS: Record<DNSLookupStatus, string> = {
  success: 'Records found',
  empty: 'No records',
  nxdomain: 'Domain not found (NXDOMAIN)',
  servfail: 'Server failure (SERVFAIL)',
  refused: 'Query refused',
  timeout: 'Query timed out',
  error: 'Lookup error',
};

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function DnsLookupTool({
  initialDomain,
  initialRecordType,
  canSave = false,
}: {
  initialDomain?: string;
  initialRecordType?: DNSRecordType;
  canSave?: boolean;
}): React.ReactElement {
  const [domain, setDomain] = useState(initialDomain ?? '');
  const [recordType, setRecordType] = useState<DNSRecordType>(
    initialRecordType ?? DNSRecordType.A
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DNSLookupResult | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!initialDomain) return;

    let cancelled = false;

    async function initialLookup() {
      setLoading(true);
      setError(null);
      setResult(null);

      try {
        const data = await apiPost<DNSLookupResult>('/api/dns/lookup', {
          domain: initialDomain,
          recordType: initialRecordType ?? DNSRecordType.A,
        });

        if (!cancelled) {
          setResult(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatApiError(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialLookup();

    return () => {
      cancelled = true;
    };
  }, [initialDomain, initialRecordType]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setSaveState('idle');
    setSaveMessage(null);

    try {
      const data = await apiPost<DNSLookupResult>('/api/dns/lookup', {
        domain,
        recordType,
      });
      setResult(data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function onSave() {
    if (!result) return;

    setSaveState('saving');
    setSaveMessage(null);

    try {
      await apiPost('/api/account/saved-analyses', {
        analysisType: 'dns_lookup',
        target: result.domain,
        result: {
          recordType: result.recordType,
          status: result.status,
          records: result.records,
          queryTime: result.queryTime,
        },
      });

      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setSaveMessage(formatApiError(err));
    }
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="grid gap-4 rounded-xl border border-line bg-white p-4 sm:grid-cols-[1fr_160px_auto]"
      >
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Domain</span>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent"
            placeholder="example.com"
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Record type</span>
          <select
            value={recordType}
            onChange={(e) => setRecordType(e.target.value as DNSRecordType)}
            className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-accent"
          >
            {RECORD_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-60 sm:w-auto"
          >
            {loading ? 'Looking up...' : 'Lookup'}
          </button>
        </div>
      </form>

      {error ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {result ? (
        <LookupResult
          result={result}
          canSave={canSave}
          saveState={saveState}
          saveMessage={saveMessage}
          onSave={onSave}
        />
      ) : null}
    </div>
  );
}

function LookupResult({
  result,
  canSave,
  saveState,
  saveMessage,
  onSave,
}: {
  result: DNSLookupResult;
  canSave: boolean;
  saveState: SaveState;
  saveMessage: string | null;
  onSave: () => void;
}): React.ReactElement {
  const rows: DnsRecordRow[] = buildRecordRows(
    result.recordType,
    result.records ?? [],
    result.domain
  );

  const soaFields =
    result.recordType === DNSRecordType.SOA && rows.length > 0
      ? buildSoaFields(rows[0].raw)
      : [];

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${
              STATUS_STYLES[result.status] ||
              'bg-slate-100 text-slate-700 ring-slate-300'
            }`}
          >
            {STATUS_LABELS[result.status] || result.status}
          </span>

          <span className="text-sm text-muted">
            {result.domain} · {result.recordType}
            {typeof result.queryTime === 'number'
              ? ` · ${result.queryTime} ms`
              : ''}
          </span>

          {canSave ? (
            <button
              type="button"
              onClick={onSave}
              disabled={saveState === 'saving' || saveState === 'saved'}
              className="ml-auto rounded-md border border-line px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-accent hover:text-accent disabled:opacity-60"
            >
              {saveState === 'saving'
                ? 'Saving...'
                : saveState === 'saved'
                  ? 'Saved to account'
                  : 'Save analysis'}
            </button>
          ) : null}
        </div>

        {saveMessage ? (
          <p className="mt-3 text-sm text-red-800">{saveMessage}</p>
        ) : null}

        {result.error ? (
          <p className="mt-3 text-sm text-red-800">{result.error}</p>
        ) : null}

        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No {result.recordType} records were returned for {result.domain}.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="px-3 py-2 font-medium text-slate-500">
                    Type
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium text-slate-500">
                    Name
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium text-slate-500">
                    Value / Target
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium text-slate-500">
                    TTL
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-ink">
                        {row.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-ink">
                      {row.name}
                    </td>
                    <td className="break-all px-3 py-2 font-mono text-xs text-ink">
                      {row.value}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">
                      {row.ttl}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-2 text-xs text-slate-500">
              TTLs are shown only when the resolver returns them; &quot;—&quot; means the TTL was not provided.
            </p>
          </div>
        )}

        {soaFields.length > 0 ? (
          <div className="mt-6 rounded-lg border border-line bg-paper p-4">
            <h3 className="font-medium text-ink">SOA details</h3>

            <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
              {soaFields.map((field) => (
                <div key={field.label} className="flex justify-between gap-4 text-sm">
                  <dt className="text-slate-600">{field.label}</dt>
                  <dd className="font-mono text-xs text-ink">{field.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>

      <details className="rounded-xl border border-line bg-white p-6">
        <summary className="cursor-pointer font-semibold text-ink">
          Technical details
        </summary>

        <pre className="mt-3 max-h-[480px] overflow-auto rounded-lg bg-slate-50 p-4 font-mono text-xs text-ink">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </section>
  );
}
