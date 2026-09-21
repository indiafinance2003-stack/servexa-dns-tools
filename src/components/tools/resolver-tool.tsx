'use client';

import { FormEvent, useState } from 'react';
import { apiPost, formatApiError } from '@/lib/client/api';
import { DNSRecordType, ResolverComparison } from '@/types/domain';

const STATUS_BADGE_STYLES: Record<string, string> = {
  success: 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/40',
  empty: 'bg-amber-500/10 text-amber-300 ring-amber-500/40',
  nxdomain: 'bg-red-500/10 text-red-300 ring-red-500/40',
  servfail: 'bg-red-500/10 text-red-300 ring-red-500/40',
  refused: 'bg-red-500/10 text-red-300 ring-red-500/40',
  timeout: 'bg-red-500/10 text-red-300 ring-red-500/40',
  error: 'bg-red-500/10 text-red-300 ring-red-500/40',
};

export function ResolverTool({
  initialDomain,
  initialRecordType,
}: {
  initialDomain?: string;
  initialRecordType?: DNSRecordType;
}): React.ReactElement {
  const [domain, setDomain] = useState(initialDomain ?? '');
  const [recordType, setRecordType] = useState<DNSRecordType>(initialRecordType ?? DNSRecordType.A);
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
      <form
        onSubmit={onSubmit}
        className="grid gap-4 rounded-xl border border-line bg-navy-surface p-4 sm:grid-cols-[1fr_160px_auto]"
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
            {Object.values(DNSRecordType).map((type) => (
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
            className="w-full rounded-md bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-60 sm:w-auto"
          >
            {loading ? 'Comparing…' : 'Compare'}
          </button>
        </div>
      </form>
      {error ? <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}
      {result ? <ResolverResult result={result} /> : null}
    </div>
  );
}

function ResolverResult({ result }: { result: ResolverComparison }): React.ReactElement {
  const badgeClasses =
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset';

  return (
    <section className="space-y-4">
      <p className="rounded-lg border border-line bg-navy-surface p-4 text-sm text-muted">{result.terminology}</p>
      <div className="overflow-x-auto rounded-xl border border-line bg-navy-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-paper">
            <tr className="border-b border-line">
              <th className="px-3 py-2 font-medium text-slate-400">Resolver</th>
              <th className="px-3 py-2 font-medium text-slate-400">Server</th>
              <th className="px-3 py-2 font-medium text-slate-400">Status</th>
              <th className="px-3 py-2 font-medium text-slate-400">Latency</th>
              <th className="px-3 py-2 font-medium text-slate-400">Answer</th>
            </tr>
          </thead>
          <tbody>
            {result.observations.map((row) => (
              <tr key={row.server} className="border-b border-slate-800 align-top">
                <td className="px-3 py-2 text-ink">{row.resolver}</td>
                <td className="px-3 py-2 font-mono text-xs text-ink">{row.server}</td>
                <td className="px-3 py-2">
                  <span
                    className={`${badgeClasses} ${STATUS_BADGE_STYLES[row.status] || 'bg-slate-800 text-slate-300 ring-slate-300'}`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-400">{row.queryTime} ms</td>
                <td className="px-3 py-2">
                  <pre className="whitespace-pre-wrap font-mono text-xs text-ink">
                    {row.error || JSON.stringify(row.answers, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-line bg-navy-surface p-6">
        <h2 className="text-lg font-semibold text-ink">Observed differences</h2>
        {result.differences.length > 0 ? (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-300">
            {result.differences.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No differences were observed among successful answers.</p>
        )}
      </div>
    </section>
  );
}