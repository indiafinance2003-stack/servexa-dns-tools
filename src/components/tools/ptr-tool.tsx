'use client';

import { FormEvent, useState } from 'react';
import { apiPost, formatApiError } from '@/lib/client/api';
import { PTRLookupResult } from '@/types/domain';

export function PtrTool(): React.ReactElement {
  const [ip, setIp] = useState('');
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
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row">
        <label className="block flex-1">
          <span className="mb-1 block text-sm font-medium">Public IP address</span>
          <input
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="8.8.8.8"
            required
          />
        </label>
        <div className="flex items-end">
          <button type="submit" disabled={loading} className="rounded-md bg-teal-800 px-4 py-2 text-white disabled:opacity-60">
            {loading ? 'Looking up…' : 'Lookup PTR'}
          </button>
        </div>
      </form>
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {result ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">
            {result.ip} · {result.status}
            {result.queryTime ? ` · ${result.queryTime} ms` : ''}
          </p>
          {result.ptrs.length === 0 ? (
            <p className="mt-3 text-sm">No PTR records were returned.</p>
          ) : (
            <ul className="mt-3 list-disc pl-5 text-sm">
              {result.ptrs.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
