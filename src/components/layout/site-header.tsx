'use client';

import Link from 'next/link';
import { useState } from 'react';
import { RavelythLogo } from '@/components/ui/logo';

const nav = [
  { href: '/dns/lookup', label: 'DNS Lookup' },
  { href: '/dns/analyze', label: 'DNS Health' },
  { href: '/email/analyze', label: 'Email Headers' },
  { href: '/docs', label: 'Docs' },
  { href: '/about', label: 'About' },
];

export function SiteHeader({
  user,
}: {
  user?: { name: string; email: string } | null;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const authenticated = Boolean(user);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        <RavelythLogo />
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-paper hover:text-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {authenticated ? (
            <>
              <Link
                href="/account"
                className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-accent hover:text-accent"
              >
                Account
              </Link>
              {/* POST-only route handler; never a rendered logout page. */}
              <form method="post" action="/logout">
                <button
                  type="submit"
                  className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-strong"
                >
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-accent hover:text-accent"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-strong"
              >
                Create Account
              </Link>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="site-navigation"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line text-ink md:hidden"
        >
          {open ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>
      {open ? (
        <div id="site-navigation" className="border-t border-line bg-white md:hidden">
          <nav aria-label="Mobile primary" className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-paper hover:text-accent"
              >
                {item.label}
              </Link>
            ))}
            <div className="my-2 h-px bg-line" aria-hidden="true" />
            {authenticated ? (
              <>
                <Link
                  href="/account"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-paper hover:text-accent"
                >
                  Account
                </Link>
                <form method="post" action="/logout" className="px-0">
                  <button
                    type="submit"
                    className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-strong"
                  >
                    Log out
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-paper hover:text-accent"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-strong"
                >
                  Create Account
                </Link>
              </>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
