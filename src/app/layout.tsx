import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { getSessionUser, type AuthenticatedUser } from '@/lib/auth/session';

const siteUrl = process.env.APP_URL || 'https://ravelyth.in';

export const viewport: Viewport = {
  themeColor: '#0f766e',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Ravelyth — Free DNS & Email Diagnostics',
    template: '%s · Ravelyth',
  },
  description:
    'Free DNS and email diagnostic tools for DNS lookup, SPF, DKIM, DMARC, nameservers, DNS health, PTR records and email header analysis.',
  applicationName: 'Ravelyth',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Ravelyth — DNS & Email Diagnostics',
    description:
      'Inspect DNS records, SPF, DKIM, DMARC, DNSSEC-related data and raw email headers using real technical evidence.',
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Ravelyth',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Ravelyth — DNS and email diagnostics',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ravelyth — DNS & Email Diagnostics',
    description:
      'Free DNS and email diagnostic tools for DNS lookup, SPF, DKIM, DMARC, nameservers, DNS health, PTR records and email header analysis.',
    images: ['/opengraph-image'],
  },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactElement> {
  // Resolves the signed-in user from the HttpOnly session cookie so the
  // header and footer can render accurate account controls. Public tools are
  // unaffected when no session exists (or when the database is unavailable).
  let user: AuthenticatedUser | null = null;
  try {
    user = await getSessionUser();
  } catch {
    user = null;
  }

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-paper text-ink">
        <SiteHeader user={user ? { name: user.name, email: user.email } : null} />
        <main className="flex-1">{children}</main>
        <SiteFooter authenticated={user !== null} />
      </body>
    </html>
  );
}
