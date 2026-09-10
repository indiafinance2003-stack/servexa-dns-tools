import Link from 'next/link';

const tools = [
  {
    href: '/dns/lookup',
    title: 'DNS Lookup',
    body: 'Query A, AAAA, MX, NS, TXT, SOA, SRV, CAA, CNAME, and PTR records.',
  },
  {
    href: '/dns/analyze',
    title: 'DNS Health',
    body: 'Inspect published records, nameservers, SPF, DMARC, and DNSSEC-related data.',
  },
  {
    href: '/dns/spf',
    title: 'SPF Checker',
    body: 'Parse SPF mechanisms and flag common configuration problems.',
  },
  {
    href: '/dns/dkim',
    title: 'DKIM Checker',
    body: 'Look up a selector and inspect the published DKIM key record.',
  },
  {
    href: '/dns/dmarc',
    title: 'DMARC Checker',
    body: 'Read the _dmarc policy, reporting tags, and alignment settings.',
  },
  {
    href: '/dns/ptr',
    title: 'PTR Lookup',
    body: 'Reverse-lookup public IPv4 and IPv6 addresses.',
  },
  {
    href: '/dns/resolvers',
    title: 'Resolver Comparison',
    body: 'Compare answers from selected public resolvers. Not a global propagation map.',
  },
  {
    href: '/email/analyze',
    title: 'Email Header Analyzer',
    body: 'Paste complete raw headers to inspect hops, auth results, and domain relationships.',
  },
];

export default function HomePage(): React.ReactElement {
  return (
    <div>
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <p className="text-sm font-medium uppercase tracking-wide text-teal-800">Free public toolkit</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900">
            Ravelyth Tools
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600">
            Diagnose DNS and email authentication configuration. Look up records, review SPF, DKIM, and DMARC, compare
            selected resolvers, and analyze raw email headers — without accounts or simulated results.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dns/analyze" className="rounded-md bg-teal-800 px-4 py-2 text-white">
              Check a domain
            </Link>
            <Link href="/email/analyze" className="rounded-md border border-slate-300 px-4 py-2">
              Analyze email headers
            </Link>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-xl font-semibold">Tools</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="rounded-xl border border-slate-200 bg-white p-5 hover:border-teal-700"
            >
              <h3 className="font-medium text-slate-900">{tool.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{tool.body}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
