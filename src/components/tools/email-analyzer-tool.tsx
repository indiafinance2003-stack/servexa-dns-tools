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
      <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Raw email headers</span>
          <textarea
            value={headers}
            onChange={(e) => setHeaders(e.target.value)}
            className="min-h-[280px] w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
            placeholder="Paste complete raw headers here"
            required
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <p>{bytes.toLocaleString()} bytes</p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-2"
              onClick={() => setHeaders(SAMPLE_EMAIL_HEADERS)}
            >
              Paste sample header
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-2"
              onClick={() => {
                setHeaders('');
                setResult(null);
                setError(null);
              }}
            >
              Clear
            </button>
            <button type="submit" disabled={loading} className="rounded-md bg-teal-800 px-4 py-2 text-white disabled:opacity-60">
              {loading ? 'Analyzing…' : 'Analyze'}
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
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-medium">Summary</h2>
        <p className="text-sm text-slate-700">
          {result.summary.headerCount} headers · {result.summary.hopCount} Received hops ·{' '}
          {result.summary.dkimSignatureCount} DKIM-Signature header(s) · {result.summary.reportedAuthMethodCount} reported
          authentication method(s)
        </p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-medium">Sender / Recipients</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">From</dt><dd>{result.senderRecipients.from || '—'}</dd></div>
          <div><dt className="text-slate-500">Return-Path</dt><dd>{result.senderRecipients.returnPath || '—'}</dd></div>
          <div><dt className="text-slate-500">To</dt><dd>{result.senderRecipients.to.join(', ') || '—'}</dd></div>
          <div><dt className="text-slate-500">Reply-To</dt><dd>{result.senderRecipients.replyTo || '—'}</dd></div>
        </dl>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-medium">Authentication</h2>
        <p className="mb-3 text-sm text-slate-600">{result.authentication.verificationPerformedByThisTool.note}</p>
        <h3 className="text-sm font-medium">Reported by receiving server</h3>
        {result.authentication.reportedByReceivingServer.length === 0 ? (
          <p className="text-sm text-slate-500">No Authentication-Results methods were parsed.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {result.authentication.reportedByReceivingServer.map((item) => (
              <li key={item.raw} className="rounded-md bg-slate-50 p-2">
                {item.authservId ? `${item.authservId}: ` : ''}
                {item.method}={item.result}
              </li>
            ))}
          </ul>
        )}
        <h3 className="mt-4 text-sm font-medium">Detected signatures / headers</h3>
        <p className="text-sm">
          DKIM-Signature: {result.authentication.detectedEvidence.dkimSignatures.length}; Received-SPF:{' '}
          {result.authentication.detectedEvidence.receivedSpf.length}; ARC headers:{' '}
          {result.authentication.detectedEvidence.arcHeaderCount}
        </p>
        <h3 className="mt-4 text-sm font-medium">Verification performed by this tool</h3>
        <p className="text-sm">SPF not performed · DKIM not performed · DMARC not performed</p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-medium">Received chain</h2>
        <p className="mb-3 text-sm text-slate-600">{result.receivedChain.chronologicalNote}</p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">From</th>
                <th className="px-2 py-2">By</th>
                <th className="px-2 py-2">With</th>
                <th className="px-2 py-2">IPs</th>
                <th className="px-2 py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {result.receivedChain.hops.map((hop, index) => (
                <tr key={hop.rawContent} className="border-t border-slate-100 align-top">
                  <td className="px-2 py-2">{index + 1}</td>
                  <td className="px-2 py-2">{hop.from || '—'}</td>
                  <td className="px-2 py-2">{hop.by || '—'}</td>
                  <td className="px-2 py-2">{hop.with || '—'}</td>
                  <td className="px-2 py-2">{hop.ipAddresses.join(', ') || '—'}</td>
                  <td className="px-2 py-2">{hop.timestamp || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-medium">Domains</h2>
        <ul className="space-y-2 text-sm">
          {result.domains.map((item) => (
            <li key={item.label}>
              <strong>{item.label}:</strong> {item.domains.join(', ') || '—'}
              <p className="text-slate-600">{item.note}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-2 font-medium">Message metadata</h2>
        <pre className="overflow-x-auto text-sm">{JSON.stringify(result.metadata, null, 2)}</pre>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 font-medium">Security observations</h2>
        <FindingsList findings={result.observations} />
      </section>
      <details className="rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer font-medium">Technical details</summary>
        <pre className="mt-3 overflow-x-auto text-xs">{JSON.stringify(result.technicalDetails, null, 2)}</pre>
      </details>
    </div>
  );
}
