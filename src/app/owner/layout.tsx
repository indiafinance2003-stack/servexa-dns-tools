import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/admin/guards';

export const dynamic = 'force-dynamic';

/**
 * Owner Room shell.
 *
 * Server-side authorization happens here on every render of every owner page —
 * hiding links is never the access control. Individual owner APIs also call
 * `requireOwner()` independently.
 */
export default async function OwnerLayout({ children }: { children: ReactNode }) {
  let ownerEmail: string;
  try {
    const owner = await requireOwner();
    ownerEmail = owner.email;
  } catch {
    redirect('/login?next=%2Fowner');
  }

  const nav = [
    { href: '/owner', label: 'Overview' },
    { href: '/owner/talent', label: 'Talent' },
  ];

  return (
    <div className="min-h-screen bg-paper">
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold tracking-tight text-ink">Ravelyth — Owner Room</span>
            <nav aria-label="Owner navigation" className="hidden items-center gap-1 sm:flex">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-paper hover:text-accent"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <span className="text-xs text-slate-500">{ownerEmail}</span>
        </div>
      </div>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
