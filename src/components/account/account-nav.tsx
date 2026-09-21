import Link from 'next/link';

const baseLinks = [
  { href: '/account', label: 'Overview' },
  { href: '/account/notifications', label: 'Notifications' },
  { href: '/account/billing', label: 'Billing' },
  { href: '/account/feedback', label: 'Feedback' },
];

/**
 * Sub-navigation for the signed-in area. Rendered server-side; every link is a
 * real, existing route and there is no client-side state involved. The Support
 * link is only shown when the account holds an active Managed Support
 * entitlement (`entitled === true`, fail closed).
 */
export function AccountNav({ entitled = false }: { entitled?: boolean }): React.ReactElement {
  const links = entitled
    ? [...baseLinks, { href: '/account/support', label: 'Support' }]
    : baseLinks;

  return (
    <nav aria-label="Account sections" className="mt-6 flex flex-wrap gap-2 text-sm">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-md border border-line px-3 py-1.5 font-medium text-slate-300 hover:border-accent hover:text-accent"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}