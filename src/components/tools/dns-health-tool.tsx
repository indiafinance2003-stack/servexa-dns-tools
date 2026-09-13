'use client';

import { FormEvent, useMemo, useState } from 'react';
import { apiPost, formatApiError } from '@/lib/client/api';
import { Finding } from '@/types/domain';
import { FindingsList } from '@/components/ui/findings-list';
import { DNSAnalysisResult } from '@/lib/dns/analysis/dns-analyzer';
import { buildSoaFields } from '@/lib/client/dns-records';

const SEVERITY_ORDER: Array<Finding['severity']> = ['error', 'warning', 'info', 'pass'];

const SEVERITY_STYLES: Record<Finding['severity'], string> = {
  pass: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
  info: 'bg-slate-100 text-slate-700 ring-slate-300',
  warning: 'bg-amber-50 text-amber-900 ring-amber-300',
  error: 'bg-red-50 text-red-900 ring-red-300',
};

const STATUS_STYLES: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-900',
  empty: 'bg-amber-50 text-amber-900',
  nxdomain: 'bg-red-50 text-red-900',
  servfail: 'bg-red-50 text-red-900',
  refused: 'bg-red-50 text-red-900',
  timeout: 'bg-red-50 text-red-900',
  error: 'bg-red-50 text-red-900',
};

function overallVerdict(findings: Finding[]): { label: string; className: string } | null {
  for (const severity of SEVERITY_ORDER) {
    if (findings.some((finding) => finding.severity === severity)) {
      switch (severity) {
        case 'error':
          return { label: 'Error severity findings present', className: 'bg-red-50 text-red-900 ring-red-300' };
        case 'warning':
          return { label: 'Warnings found', className: 'bg-amber-50 text-amber-900 ring-amber-300' };
        case 'info':
          return { label: 'Info findings found', className: 'bg-slate-100 text-slate-700 ring-slate-300' };
        case 'pass':
          return { label: 'All checks passed', className: 'bg-emerald-50 text-emerald-900 ring-emerald-200' };
      }
    }
  }
  return null;
}

function severityCounts(findings: Finding[]): Array<{ severity: Finding['severity']; count: number }> {
  return SEVERITY_ORDER.map((severity) => ({
    severity,
    count: findings.filter((finding) => finding.severity === severity).length,
  })).filter((item) => item.count > 0);
}

export function DnsHealthTool({ initialDomain }: { initialDomain?: string }): React.ReactElement {
  const [domain, setDomain] = useState(initialDomain ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DNSAnalysisResult | null>(null);
  const verdict = useMemo(() => (result ? overallVerdict(result.findings) : null), [result]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await apiPost<DNSAnalysisResult>('/api/dns/analyze', { domain });
      setResult(data);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4 sm:flex-row">
        <label className="block flex-1">
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
        <div className="flex items-end">
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-60 sm:w-auto"
          >
            {loading ? 'Analyzing…' : 'Analyze DNS'}
          </button>
        </div>
      </form>
      {error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {result ? <DnsHealthResult result={result} verdict={verdict} /> : null}
    </div>
  );
}

function DnsHealthResult({
  result,
  verdict,
}: {
  result: DNSAnalysisResult;
  verdict: { label: string; className: string } | null;
}): React.ReactElement {
  const counts = severityCounts(result.findings);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Findings for {result.domain}</h2>
          {verdict ? (
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${verdict.className}`}>
              {verdict.label}
            </span>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {counts.map((item) => (
            <span
              key={item.severity}
              className={`rounded-full px-3 py-1 text-xs font-medium ${SEVERITY_STYLES[item.severity]}`}
            >
              {item.count} {item.severity}
            </span>
          ))}
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {result.findings.length} total
          </span>
        </div>
        <div className="mt-6">
          <FindingsList findings={result.findings} />
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-lg font-semibold text-ink">DNS records</h2>
        <p className="mt-1 text-sm text-muted">Observed by this resolver during the analysis.</p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <RecordGroup label="A (IPv4)" items={result.records.a.map((r) => r.address)} />
          <RecordGroup label="AAAA (IPv6)" items={result.records.aaaa.map((r) => r.address)} />
          <RecordGroup label="CNAME" items={result.records.cname} />
          <RecordGroup
            label="MX"
            items={result.records.mx.map((r) => `${r.priority} ${r.exchange}`)}
          />
          <RecordGroup label="NS" items={result.records.ns.map((r) => r.nameserver)} />
          <RecordGroup label="TXT" items={result.records.txt} />
          <RecordGroup
            label="CAA"
            items={result.records.caa.map((r) => `${r.flags} ${r.tag} "${r.value}"`)}
          />
        </dl>
      </section>

      {result.records.soa ? (
        <section className="rounded-xl border border-line bg-white p-6">
          <h2 className="text-lg font-semibold text-ink">SOA</h2>
          <p className="mt-1 text-sm text-muted">
            Start of authority values as returned by this resolver.
          </p>
          <dl className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {buildSoaFields(result.records.soa).map((field) => (
              <div key={field.label} className="flex justify-between gap-4 text-sm">
                <dt className="text-slate-600">{field.label}</dt>
                <dd className="font-mono text-xs text-ink">{field.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-lg font-semibold text-ink">DNSSEC</h2>
        <p className="mt-2 rounded-lg bg-paper p-3 text-sm text-slate-700">
          {DNSSEC_LABELS[result.dnssec.determination] ?? result.dnssec.determination}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Ravelyth reports whether DNSSEC-related records (DS, DNSKEY, RRSIG) are observed. It does not perform
          cryptographic chain-of-trust validation.
        </p>
        {(result.dnssec.dsRecords.length > 0 || result.dnssec.dnskeyRecords.length > 0) && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <RecordGroup label="DS records observed" items={result.dnssec.dsRecords.map((r) => JSON.stringify(r))} />
            <RecordGroup
              label="DNSKEY records observed"
              items={result.dnssec.dnskeyRecords.map((r) => JSON.stringify(r))}
            />
          </div>
        )}
      </section>

      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-lg font-semibold text-ink">Nameservers</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-3 py-2 font-medium text-slate-500">Hostname</th>
                <th className="px-3 py-2 font-medium text-slate-500">Addresses</th>
                <th className="px-3 py-2 font-medium text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {result.nameservers.nameservers.length === 0 ? (
                <tr>
                  <td className="px-3 py-2 text-muted" colSpan={3}>
                    No nameserver data was observed.
                  </td>
                </tr>
              ) : (
                result.nameservers.nameservers.map((server) => (
                  <tr key={server.hostname} className="border-b border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs text-ink">{server.hostname}</td>
                    <td className="px-3 py-2 font-mono text-xs text-ink">
                      {server.addresses.length > 0 ? server.addresses.join(', ') : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[server.lookupStatus] || 'bg-slate-100 text-slate-700'}`}
                      >
                        {server.lookupStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-6">
        <h2 className="text-lg font-semibold text-ink">SPF &amp; DMARC</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-line bg-paper p-4">
            <h3 className="font-medium text-ink">SPF</h3>
            {result.spf.records.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No SPF records were observed.</p>
            ) : (
              <pre className="mt-2 overflow-x-auto rounded-md bg-white p-3 font-mono text-xs text-ink">
                {result.spf.records.join('\n')}
              </pre>
            )}
          </div>
          <div className="rounded-lg border border-line bg-paper p-4">
            <h3 className="font-medium text-ink">DMARC</h3>
            {result.dmarc.records.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No DMARC records were observed.</p>
            ) : (
              <pre className="mt-2 overflow-x-auto rounded-md bg-white p-3 font-mono text-xs text-ink">
                {result.dmarc.records.join('\n')}
              </pre>
            )}
          </div>
        </div>
      </section>

      <details className="rounded-xl border border-line bg-white p-6">
        <summary className="cursor-pointer font-semibold text-ink">Technical details</summary>
        <pre className="mt-3 max-h-[480px] overflow-auto rounded-lg bg-slate-50 p-4 font-mono text-xs text-ink">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </div>
  );
}
const DNSSEC_LABELS: Record<string, string> = {
  appears_enabled: 'DNSSEC-related records were observed (DS/DNSKEY/RRSIG present).',
  appears_absent: 'No DNSSEC-related records were observed.',
  could_not_be_determined: 'DNSSEC status could not be determined from this resolver.',
  possible_validation_failure: 'Records exist but validation signals look inconsistent.',
};

function RecordGroup({ label, items }: { label: string; items: string[] }): React.ReactElement {
  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <dt className="text-sm font-medium text-ink">{label}</dt>
      <dd className="mt-2">
        {items.length === 0 ? (
          <span className="text-sm text-muted">—</span>
        ) : (
          <ul className="space-y-1">
            {items.map((item, index) => (
              <li key={`${label}-${index}`} className="break-all font-mono text-xs text-ink">
                {item}
              </li>
            ))}
          </ul>
        )}
      </dd>
    </div>
  );
}
