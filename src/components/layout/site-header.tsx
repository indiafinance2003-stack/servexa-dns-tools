import Link from 'next/link';

const nav = [
  { href: '/dns/lookup', label: 'DNS Lookup' },
  { href: '/dns/analyze', label: 'DNS Health' },
  { href: '/email/analyze', label: 'Email Headers' },
  { href: '/docs', label: 'Docs' },
];

export function SiteHeader(): React.ReactElement {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="font-semibold tracking-tight text-slate-900">
          Ravelyth Tools
        </Link>
        <nav aria-label="Primary" className="flex flex-wrap items-center justify-end gap-3 text-sm text-slate-600">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-teal-800">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
