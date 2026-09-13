'use client';

import { FormEvent, useMemo, useState } from 'react';
import { apiPost, formatApiError } from '@/lib/client/api';
import { EmailAnalysis } from '@/types/domain';
import { FindingsList } from '@/components/ui/findings-list';
import { SAMPLE_EMAIL_HEADERS } from '@/lib/email/fixtures/sample-headers';

export function EmailAnalyzerTool(): React.ReactElement {
  const [headers, setHeaders] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EmailAnalysis | null>(null);
  const bytes = useMemo(() => new TextEncoder().encode(headers).length, [headers]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiPost<EmailAnalysis>('/api/email/analyze', { headers });
      setResult(data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-line bg-white p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-ink">Raw email headers</span>
          <textarea
            value={headers}
            onChange={(e) => setHeaders(e.target.value)}
            className="min-h-[280px] w-full rounded-md border border-line px-3 py-2 font-mono text-sm text-ink placeholder:text-slate-400 focus:border-accent"
            placeholder="Paste complete raw headers here"
            required
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <p>{bytes.toLocaleString()} bytes</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border border-line bg-white px-3 py-2 text-ink hover:border-accent hover:text-accent"
              onClick={() => setHeaders(SAMPLE_EMAIL_HEADERS)}
            >
              Paste sample header
            </button>
            <button
              type="button"
              className="rounded-md border border-line bg-white px-3 py-2 text-ink hover:border-accent hover:text-accent"
              onClick={() => {
                setHeaders('');
                setResult(null);
                setError(null);
              }}
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong disabled:opacity-60"
            >
              {loading ? 'Analyzingâ€¦' : 'Analyze'}
            </button>
          </div>
        </div>
      </form>
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {result ? <EmailResults result={result} /> : null}
    </div>
  );
}

function EmailResults({ result }: { result: EmailAnalysis }): React.ReactElement {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="mb-2 font-semibold text-ink">Summary</h2>
        <p className="text-sm text-slate-700">
          {result.summary.headerCount} headers Â· {result.summary.hopCount} Received hops Â·{' '}
          {result.summary.dkimSignatureCount} DKIM-Signature header(s) Â· {result.summary.reportedAuthMethodCount} reported
          authentication method(s)
        </p>
      </section>
      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="mb-2 font-semibold text-ink">Sender / Recipients</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">From</dt><dd className="text-ink">{result.senderRecipients.from || 'â€”'}</dd></div>
          <div><dt className="text-slate-500">Return-Path</dt><dd className="text-ink">{result.senderRecipients.returnPath || 'â€”'}</dd></div>
          <div><dt className="text-slate-500">To</dt><dd className="text-ink">{result.senderRecipients.to.join(', ') || 'â€”'}</dd></div>
          <div><dt className="text-slate-500">Reply-To</dt><dd className="text-ink">{result.senderRecipients.replyTo || 'â€”'}</dd></div>
        </dl>
      </section>
      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="mb-2 font-semibold text-ink">Authentication</h2>
        <p className="mb-3 text-sm text-muted">{result.authentication.verificationPerformedByThisTool.note}</p>
        <h3 className="text-sm font-medium text-ink">Reported by receiving server</h3>
        {result.authentication.reportedByReceivingServer.length === 0 ? (
          <p className="text-sm text-muted">No Authentication-Results methods were parsed.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {result.authentication.reportedByReceivingServer.map((item) => (
              <li key={item.raw} className="rounded-md bg-paper p-2 text-ink">
                {item.authservId ? `${item.authservId}: ` : ''}
                {item.method}={item.result}
              </li>
            ))}
          </ul>
        )}
        <h3 className="mt-4 text-sm font-medium text-ink">Detected signatures / headers</h3>
        <p className="text-sm text-ink">
          DKIM-Signature: {result.authentication.detectedEvidence.dkimSignatures.length}; Received-SPF:{' '}
          {result.authentication.detectedEvidence.receivedSpf.length}; ARC headers:{' '}
          {result.authentication.detectedEvidence.arcHeaderCount}
        </p>
        <h3 className="mt-4 text-sm font-medium text-ink">Verification performed by this tool</h3>
        <p className="text-sm text-ink">SPF not performed Â· DKIM not performed Â· DMARC not performed</p>
      </section>
      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="mb-2 font-semibold text-ink">Received chain</h2>
        <p className="mb-3 text-sm text-muted">{result.receivedChain.chronologicalNote}</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper">
              <tr className="border-b border-line">
                <th className="px-2 py-2 font-medium text-slate-500">#</th>
                <th className="px-2 py-2 font-medium text-slate-500">From</th>
                <th className="px-2 py-2 font-medium text-slate-500">By</th>
                <th className="px-2 py-2 font-medium text-slate-500">With</th>
                <th className="px-2 py-2 font-medium text-slate-500">IPs</th>
                <th className="px-2 py-2 font-medium text-slate-500">Time</th>
              </tr>
            </thead>
            <tbody>
              {result.receivedChain.hops.map((hop, index) => (
                <tr key={hop.rawContent} className="border-b border-slate-100 align-top">
                  <td className="px-2 py-2 text-ink">{index + 1}</td>
                  <td className="px-2 py-2 text-ink">{hop.from || 'â€”'}</td>
                  <td className="px-2 py-2 text-ink">{hop.by || 'â€”'}</td>
                  <td className="px-2 py-2 text-ink">{hop.with || 'â€”'}</td>
                  <td className="px-2 py-2 text-ink">{hop.ipAddresses.join(', ') || 'â€”'}</td>
                  <td className="px-2 py-2 text-ink">{hop.timestamp || 'â€”'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="mb-2 font-semibold text-ink">Domains</h2>
        <ul className="space-y-2 text-sm">
          {result.domains.map((item) => (
            <li key={item.label} className="text-ink">
              <strong>{item.label}:</strong> {item.domains.join(', ') || 'â€”'}
              <p className="text-muted">{item.note}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="mb-2 font-semibold text-ink">Message metadata</h2>
        <pre className="overflow-x-auto rounded-lg bg-paper p-4 font-mono text-xs text-ink">
          {JSON.stringify(result.metadata, null, 2)}
        </pre>
      </section>
      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="mb-3 font-semibold text-ink">Security observations</h2>
        <FindingsList findings={result.observations} />
      </section>
      <details className="rounded-xl border border-line bg-white p-6">
        <summary className="cursor-pointer font-semibold text-ink">Technical details</summary>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-paper p-4 font-mono text-xs text-ink">
          {JSON.stringify(result.technicalDetails, null, 2)}
        </pre>
      </details>
    </div>
  );
}
