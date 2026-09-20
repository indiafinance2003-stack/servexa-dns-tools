import Link from 'next/link';

const links = [
  { href: '/account', label: 'Overview' },
  { href: '/account/support', label: 'Support' },
  { href: '/account/notifications', label: 'Notifications' },
  { href: '/account/billing', label: 'Billing' },
];

/**
 * Sub-navigation for the signed-in area. Rendered server-side; every link is a
 * real, existing route and there is no client-side state involved.
 */
export function AccountNav(): React.ReactElement {
  return (
    <nav aria-label="Account sections" className="mt-6 flex flex-wrap gap-2 text-sm">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="rounded-md border border-line px-3 py-1.5 font-medium text-slate-700 hover:border-accent hover:text-accent"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
