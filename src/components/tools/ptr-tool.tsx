'use client';

import { FormEvent, useState } from 'react';
import { apiPost, formatApiError } from '@/lib/client/api';
import { PTRLookupResult } from '@/types/domain';

export function PtrTool({ initialIp }: { initialIp?: string }): React.ReactElement {
  const [ip, setIp] = useState(initialIp ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PTRLookupResult | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiPost<PTRLookupResult>('/api/dns/ptr', { ip });
      setResult(data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-xl border border-line bg-navy-surface p-4 sm:flex-row">
        <label className="block flex-1">
          <span className="mb-1 block text-sm font-medium text-ink">Public IP address</span>
          <input
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent"
            placeholder="8.8.8.8"
            required
            autoComplete="off"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-60 sm:w-auto"
          >
            {loading ? 'Looking up…' : 'Lookup PTR'}
          </button>
        </div>
      </form>
      {error ? <p className="rounded-md bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}
      {result ? (
        <section className="rounded-xl border border-line bg-navy-surface p-6">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-mono text-xs text-ink">{result.ip}</span>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${
                result.status === 'success'
                  ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/40'
                  : result.status === 'empty'
                    ? 'bg-amber-500/10 text-amber-300 ring-amber-500/40'
                    : 'bg-red-500/10 text-red-300 ring-red-500/40'
              }`}
            >
              {result.status}
            </span>
            <span className="text-muted">{result.queryTime ? `${result.queryTime} ms` : null}</span>
          </div>
          {result.ptrs.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No PTR records were returned.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {result.ptrs.map((name) => (
                <li
                  key={name}
                  className="rounded-lg border border-line bg-paper px-3 py-2 font-mono text-xs text-ink"
                >
                  {name}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}