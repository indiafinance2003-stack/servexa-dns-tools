import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Documentation',
  description: 'How Ravelyth Tools works, what it measures, and what it does not claim.',
};

export default function Page(): React.ReactElement {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Documentation</h1>
      <p className="mt-4 text-slate-600">
        Ravelyth Tools is a public, stateless diagnostics website. It queries DNS through Node.js resolver APIs and
        parses email headers you paste. It does not store reports and does not require an account.
      </p>
      <h2 className="mt-8 text-xl font-semibold">Tools</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
        <li>
          <Link href="/dns/lookup">DNS Lookup</Link> — selected record types for a domain.
        </li>
        <li>
          <Link href="/dns/analyze">DNS Health</Link> — structured findings from A/AAAA/MX/NS/TXT/SOA/CAA plus SPF, DMARC,
          nameservers, and DNSSEC record presence.
        </li>
        <li>
          <Link href="/dns/resolvers">Resolver comparison</Link> — answers from a small set of public resolvers, not global
          propagation.
        </li>
        <li>
          <Link href="/email/analyze">Email headers</Link> — Received chain, Authentication-Results as reported by a
          receiving server, and domain relationships.
        </li>
      </ul>
      <h2 className="mt-8 text-xl font-semibold">What this tool does not do</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
        <li>It does not cryptographically verify DKIM signatures.</li>
        <li>It does not perform a live SPF authorization test unless you are only inspecting published policy.</li>
        <li>It does not declare mail safe or malicious.</li>
        <li>It does not scan private, loopback, or link-local addresses.</li>
        <li>DNSSEC inspection reports record presence, not a validated chain of trust.</li>
      </ul>
      <h2 className="mt-8 text-xl font-semibold">API</h2>
      <p className="mt-3 text-slate-700">
        JSON endpoints live under <code>/api</code>. Domain tools accept GET query parameters or POST JSON. Email analysis
        is POST-only. Responses use <code>{'{ success, data }'}</code> or <code>{'{ success, error }'}</code>.
      </p>
    </div>
  );
}
