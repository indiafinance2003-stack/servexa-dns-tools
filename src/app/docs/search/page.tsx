import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage, InfoSection } from '@/components/layout/info-page';
import { searchPublicArticles } from '@/lib/kb/service';

export const metadata: Metadata = {
  title: 'Search the Knowledge Base',
  description: 'Search Ravelyth troubleshooting guides for DNS, email, WordPress, VPS and SSL problems.',
  alternates: { canonical: '/docs/search' },
  robots: { index: false, follow: true },
};

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: PageProps): Promise<React.ReactElement> {
  const { q } = await searchParams;
  const query = (q ?? '').trim().slice(0, 100);
  const results = query.length >= 2 ? await searchPublicArticles(query) : null;

  return (
    <InfoPage
      title="Search the Knowledge Base"
      intro="Find a troubleshooting guide by keyword — for example “DMARC”, “503”, or “nameserver”."
    >
      <InfoSection title="Search" id="search">
        <form action="/docs/search" method="get" role="search" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            maxLength={100}
            placeholder="e.g. email bounced"
            aria-label="Search guides"
            className="w-full rounded-md border border-line bg-navy-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
          >
            Search
          </button>
        </form>
      </InfoSection>

      {results ? (
        <InfoSection title={`Results for “${query}”`} id="results">
          {results.available ? (
            results.data.length > 0 ? (
              <ul className="space-y-3">
                {results.data.map((article) => (
                  <li key={article.slug}>
                    <Link
                      href={`/docs/${article.slug}`}
                      className="font-medium text-accent hover:text-accent-strong"
                    >
                      {article.title}
                    </Link>
                    {article.description ? (
                      <p className="mt-0.5 text-sm text-slate-400">{article.description}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                No guides matched “{query}”. Try a shorter keyword, or{' '}
                <Link href="/support/request" className="font-medium text-accent hover:text-accent-strong">
                  request support
                </Link>
                .
              </p>
            )
          ) : (
            <p>Search is temporarily unavailable. Please try again shortly.</p>
          )}
        </InfoSection>
      ) : null}
    </InfoPage>
  );
}