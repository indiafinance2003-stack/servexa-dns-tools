import Link from 'next/link';
import { ToolIcon } from '@/components/home/tool-icons';
import { DomainSearch } from '@/components/home/domain-search';

const tools = [
  {
    href: '/dns/lookup',
    icon: 'globe',
    title: 'DNS Lookup',
    body: 'Query A, AAAA, CNAME, MX, NS, TXT, SOA, SRV, and CAA records with a clear record table plus the raw response for reference.',
  },
  {
    href: '/dns/analyze',
    icon: 'scan',
    title: 'DNS Health',
    body: 'Inspect published records, nameservers, SPF, DMARC, and DNSSEC-related data with structured Pass, Info, Warning, or Error findings.',
  },
  {
    href: '/dns/spf',
    icon: 'shield',
    title: 'SPF Checker',
    body: 'Parse v=spf1 mechanisms and modifiers, review include chains, and flag common configuration problems.',
  },
  {
    href: '/dns/dkim',
    icon: 'key',
    title: 'DKIM Checker',
    body: 'Look up a selector and inspect the published DKIM public key record. Cryptographic signature verification is not performed.',
  },
  {
    href: '/dns/dmarc',
    icon: 'shield',
    title: 'DMARC Checker',
    body: 'Read the published _dmarc policy, reporting tags, percentage, and alignment settings for the domain.',
  },
  {
    href: '/dns/ptr',
    icon: 'reverse',
    title: 'PTR Lookup',
    body: 'Reverse-lookup public IPv4 and IPv6 addresses. Private, loopback, and link-local targets are rejected.',
  },
  {
    href: '/dns/resolvers',
    icon: 'compare',
    title: 'Resolver Comparison',
    body: 'Compare answers from selected public resolvers side by side. Observed responses, not a global propagation map.',
  },
  {
    href: '/email/analyze',
    icon: 'mail',
    title: 'Email Header Analyzer',
    body: 'Paste complete raw headers to inspect Received hops, reported authentication results, and domain relationships.',
  },
];

const ecosystem: Array<{
  href: string;
  icon: string;
  title: string;
  body: string;
  status: { label: string; tone: 'live' | 'soon' };
}> = [
  {
    href: '/#tools',
    icon: 'globe',
    title: 'Diagnostic Tools',
    body: 'Free DNS and email diagnostics — lookups, health checks, SPF / DKIM / DMARC parsing, and email header analysis.',
    status: { label: 'Free', tone: 'live' },
  },
  {
    href: '/pricing',
    icon: 'headset',
    title: 'Managed Support',
    body: 'A person who owns the diagnosis for your DNS, email, and hosting problems, with tracked tickets in your account.',
    status: { label: 'Available', tone: 'live' },
  },
  {
    href: '/control',
    icon: 'server',
    title: 'Ravelyth Control',
    body: 'Infrastructure control plane for your servers — licensing, remote agent commands, and software delivery.',
    status: { label: 'Coming soon', tone: 'soon' },
  },
  {
    href: '/talent',
    icon: 'doc',
    title: 'Ravelyth Talent',
    body: 'A private technical staffing directory for the network-aligned work that keeps your stack running.',
    status: { label: 'Available', tone: 'live' },
  },
];

const steps: Array<{ title: string; body: string }> = [
  {
    title: 'Run the query',
    body: 'Ravelyth resolves live DNS data through Node.js resolver APIs for the record types you select, with timeouts and query budgets.',
  },
  {
    title: 'Parse the evidence',
    body: 'Records, email headers, and authentication-related text are normalized into structured, human-readable results.',
  },
  {
    title: 'Review the findings',
    body: 'Each finding is labeled Pass, Info, Warning, or Error with a clear explanation of the observed evidence. No unexplained score is assigned.',
  },
];

const trustItems: Array<{ title: string; body: string }> = [
  { title: 'Real lookups', body: 'Results come from live queries through this application\'s resolver, not from simulated data.' },
  { title: 'No login required', body: 'Every tool is free and open to use — accounts remain entirely optional.' },
  { title: 'Plain verdicts', body: 'Findings use structured Pass / Info / Warning / Error labels with explanations, never an unexplained score.' },
  { title: 'Privacy-first', body: 'Anonymous lookups are not stored. Accounts are optional; only DNS analyses you explicitly save are kept, and raw email headers are never stored.' },
  { title: 'Private targets rejected', body: 'Private, loopback, and link-local addresses are never queried.' },
  { title: 'Clear limits', body: 'DKIM cryptographic verification, live SPF authorization tests, and global propagation measurements are explicitly out of scope.' },
];

function structuredData(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'Ravelyth',
        url: 'https://ravelyth.in',
      },
      {
        '@type': 'ItemList',
        name: 'Free DNS and email diagnostic tools',
        itemListElement: tools.map((tool, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: tool.title,
          url: `https://ravelyth.in${tool.href}`,
        })),
      },
    ],
  });
}

export default function HomePage(): React.ReactElement {
  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: structuredData() }}
      />
      <section className="bg-tech-grid border-b border-line bg-navy-surface">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center">
          <span className="inline-flex items-center rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium uppercase tracking-wide text-accent">
            Free public toolkit
          </span>
          <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            DNS &amp; Email Diagnostics,
            <br />
            Made Clear.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
            Look up DNS records, inspect SPF, DKIM, and DMARC, review nameservers and DNSSEC-related data, compare
            selected resolvers, and analyze raw email headers — with real lookups and structured findings.
          </p>
          <div className="mx-auto mt-8 max-w-xl">
            <DomainSearch />
            <p className="mt-3 text-xs text-slate-400">
              Start with a full domain health check, or pick a specific tool below.
            </p>
          </div>
        </div>
      </section>
      <section className="border-t border-line bg-navy-surface">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-ink">One ecosystem, four products</h2>
            <p className="mt-3 text-lg text-muted">
              The free diagnostics are the front door. Around them, Ravelyth runs a stricter, accountable layer.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ecosystem.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col rounded-xl border border-line bg-paper p-5 transition hover:border-accent"
              >
                <div className="flex items-center justify-between">
                  <ToolIcon name={item.icon} />
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      item.status.tone === 'live'
                        ? 'bg-emerald-500/10 text-emerald-300'
                        : 'bg-amber-500/10 text-amber-300'
                    }`}
                  >
                    {item.status.label}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-ink group-hover:text-accent">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section id="tools" className="mx-auto max-w-7xl px-4 py-16">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-ink">Every diagnostic in one place</h2>
          <p className="mt-3 text-lg text-muted">
            Eight focused tools, each built around a single job: resolve the live evidence and explain what it means.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group flex flex-col rounded-xl border border-line bg-navy-surface p-5 transition hover:border-accent hover:shadow-sm"
            >
              <ToolIcon name={tool.icon} />
              <h3 className="mt-4 text-base font-semibold text-ink group-hover:text-accent">{tool.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{tool.body}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-7xl px-4 py-16">
          <h2 className="text-3xl font-semibold tracking-tight text-ink">How it works</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="rounded-xl border border-line bg-navy-surface p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-ink">Why you can trust the results</h2>
          <p className="mt-3 text-lg text-muted">
            Diagnostics are only useful when you know exactly what was measured, and what was not.
          </p>
        </div>
        <dl className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {trustItems.map((item) => (
            <div key={item.title} className="border-t border-line pt-5">
              <dt className="text-sm font-semibold uppercase tracking-wide text-accent">{item.title}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="border-t border-line bg-navy-surface">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-ink">Start with your domain</h2>
          <p className="mt-3 text-lg text-muted">
            Enter a domain to run a full health check: records, nameservers, SPF, DMARC, and DNSSEC-related data in
            one report.
          </p>
          <div className="mx-auto mt-8 max-w-xl">
            <DomainSearch label="Run health check" />
          </div>
        </div>
      </section>
    </div>
  );
}
