import type { Metadata } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';

const siteUrl = process.env.APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Ravelyth Tools',
    template: '%s · Ravelyth Tools',
  },
  description:
    'Free public DNS and email diagnostics toolkit. Look up DNS records, inspect SPF, DKIM, and DMARC, compare resolvers, and analyze raw email headers.',
  openGraph: {
    title: 'Ravelyth Tools',
    description:
      'Free public DNS and email diagnostics toolkit for looking up records and analyzing email headers.',
    type: 'website',
    url: siteUrl,
    siteName: 'Ravelyth Tools',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
