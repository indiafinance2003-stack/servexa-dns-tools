'use client';

import { FormEvent, useState } from 'react';
import { apiPost, formatApiError } from '@/lib/client/api';
import { DNSRecordType, ResolverComparison } from '@/types/domain';

export function ResolverTool(): React.ReactElement {
  const [domain, setDomain] = useState('');
  const [recordType, setRecordType] = useState<DNSRecordType>(DNSRecordType.A);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResolverComparison | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiPost<ResolverComparison>('/api/dns/resolvers', { domain, recordType });
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
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Record type</span>
          <select
            value={recordType}
            onChange={(e) => setRecordType(e.target.value as DNSRecordType)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          >
            {Object.values(DNSRecordType).map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={loading} className="rounded-md bg-teal-800 px-4 py-2 text-white disabled:opacity-60">
            {loading ? 'Comparing…' : 'Compare'}
          </button>
        </div>
      </form>
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {result ? (
        <section className="space-y-4">
          <p className="text-sm text-slate-600">{result.terminology}</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2">Resolver</th>
                  <th className="px-3 py-2">Server</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Latency</th>
                  <th className="px-3 py-2">Answer</th>
                </tr>
              </thead>
              <tbody>
                {result.observations.map((row) => (
                  <tr key={row.server} className="border-t border-slate-100">
                    <td className="px-3 py-2">{row.resolver}</td>
                    <td className="px-3 py-2">{row.server}</td>
                    <td className="px-3 py-2">{row.status}</td>
                    <td className="px-3 py-2">{row.queryTime} ms</td>
                    <td className="px-3 py-2">
                      <pre className="whitespace-pre-wrap text-xs">{row.error || JSON.stringify(row.answers, null, 2)}</pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.differences.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {result.differences.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">No differences were observed among successful answers.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
