import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/admin/guards';

export const dynamic = 'force-dynamic';

/**
 * Ravelyth Talent shell.
 *
 * Authorization is enforced here as well as in the parent Owner layout and in
 * every page and API route — a hidden link is never the access control.
 */
const sections = [
  { href: '/owner/talent', label: 'Dashboard' },
  { href: '/owner/talent/jobs', label: 'Jobs' },
  { href: '/owner/talent/candidates', label: 'Candidates' },
  { href: '/owner/talent/applications', label: 'Applications' },
  { href: '/owner/talent/clients', label: 'Clients' },
  { href: '/owner/talent/interviews', label: 'Interviews' },
  { href: '/owner/talent/placements', label: 'Placements' },
];

export default async function OwnerTalentLayout({ children }: { children: ReactNode }) {
  try {
    await requireOwner();
  } catch {
    redirect('/login?next=%2Fowner%2Ftalent');
  }

  return (
    <div>
      <nav aria-label="Talent sections" className="flex flex-wrap gap-1 border-b border-line pb-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-white hover:text-accent"
          >
            {section.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">{children}</div>
    </div>
  );
}
