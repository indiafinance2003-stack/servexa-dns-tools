'use client';

import { FormEvent, useState } from 'react';
import { apiPost, formatApiError } from '@/lib/client/api';
import { DNSRecordType } from '@/types/domain';

const RECORD_TYPES = Object.values(DNSRecordType);

export function DnsLookupTool(): React.ReactElement {
  const [domain, setDomain] = useState('');
  const [recordType, setRecordType] = useState<DNSRecordType>(DNSRecordType.A);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiPost<Record<string, unknown>>('/api/dns/lookup', { domain, recordType });
      setResult(data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_160px_auto]">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Domain</span>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="example.com"
            required
            autoComplete="off"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Record type</span>
          <select
            value={recordType}
            onChange={(e) => setRecordType(e.target.value as DNSRecordType)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          >
            {RECORD_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={loading} className="w-full rounded-md bg-teal-800 px-4 py-2 text-white disabled:opacity-60">
            {loading ? 'Looking up…' : 'Lookup'}
          </button>
        </div>
      </form>
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {result ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-medium">Results</h2>
          <p className="mb-3 text-sm text-slate-600">
            Status: {String(result.status)}
            {typeof result.queryTime === 'number' ? ` · ${result.queryTime} ms` : ''}
          </p>
          <pre className="overflow-x-auto rounded-md bg-slate-50 p-3 text-sm">{JSON.stringify(result.records, null, 2)}</pre>
        </section>
      ) : null}
    </div>
  );
}
