'use client';

import { FormEvent, useState } from 'react';
import { apiPost, formatApiError } from '@/lib/client/api';
import { FindingsList } from '@/components/ui/findings-list';
import { Finding } from '@/types/domain';

interface AnalyzeResult {
  findings?: Finding[];
}

export function DomainAnalyzeTool({
  endpoint,
  extraFields,
  initialDomain,
  initialSelector,
}: {
  endpoint: string;
  extraFields?: Array<{ name: string; label: string; placeholder?: string }>;
  initialDomain?: string;
  initialSelector?: string;
}): React.ReactElement {
  const [domain, setDomain] = useState(initialDomain ?? '');
  const [extras, setExtras] = useState<Record<string, string>>(
    initialSelector ? { selector: initialSelector } : {}
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiPost<AnalyzeResult>(endpoint, { domain, ...extras });
      setResult(data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="grid gap-4 rounded-xl border border-line bg-white p-4 sm:grid-cols-[1fr_auto]">
        <label className="block sm:col-span-2">
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
        {extraFields?.map((field) => (
          <label key={field.name} className="block">
            <span className="mb-1 block text-sm font-medium text-ink">{field.label}</span>
            <input
              value={extras[field.name] || ''}
              onChange={(e) => setExtras((current) => ({ ...current, [field.name]: e.target.value }))}
              className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-accent"
              placeholder={field.placeholder}
              required
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>
        ))}
        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-60"
          >
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      </form>
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {result ? (
        <div className="space-y-4">
          <FindingsList findings={result.findings || []} />
          <details className="rounded-xl border border-line bg-white p-4">
            <summary className="cursor-pointer font-semibold text-ink">Technical details</summary>
            <pre className="mt-3 max-h-[480px] overflow-auto rounded-lg bg-slate-50 p-4 font-mono text-xs text-ink">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}