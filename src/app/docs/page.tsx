import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage, InfoSection, InfoLinkList } from '@/components/layout/info-page';
import { listPublicCategories, listPublicArticles } from '@/lib/kb/service';

export const metadata: Metadata = {
  title: 'Knowledge Base',
  description:
    'Troubleshooting guides for DNS propagation, nameservers, SPF, DKIM, DMARC, email delivery, WordPress errors, VPS and SSL problems — with structured diagnostic steps.',
  alternates: { canonical: '/docs' },
};

export const dynamic = 'force-dynamic';

export default async function Page(): Promise<React.ReactElement> {
  const categories = await listPublicCategories();
  const articles = await listPublicArticles();

  const articleCountByCategory = new Map<string, number>();
  for (const article of articles.data) {
    articleCountByCategory.set(
      article.categorySlug,
      (articleCountByCategory.get(article.categorySlug) ?? 0) + 1
    );
  }

  const featured = articles.data.filter((article) => article.featured).slice(0, 3);

  return (
    <InfoPage
      title="Knowledge Base"
      intro="Structured troubleshooting guides: what the problem looks like, what to collect, how to diagnose it with the free tools, and how to fix it."
    >
      {featured.length > 0 ? (
        <InfoSection title="Featured guides" id="featured">
          <InfoLinkList
            items={featured.map((article) => ({
              label: article.title,
              href: `/docs/${article.slug}`,
              note: article.description ?? undefined,
            }))}
          />
        </InfoSection>
      ) : null}

      {categories.data.length > 0 ? (
        <InfoSection title="Browse by topic" id="categories">
          <div className="grid gap-4 sm:grid-cols-2">
            {categories.data.map((category) => (
              <Link
                key={category.slug}
                href={`/docs/category/${category.slug}`}
                className="block rounded-lg border border-line p-4 transition hover:border-accent"
              >
                <h3 className="font-semibold text-ink">{category.title}</h3>
                {category.description ? (
                  <p className="mt-1 text-sm text-slate-400">{category.description}</p>
                ) : null}
                <p className="mt-2 text-xs uppercase tracking-wide text-accent">
                  {articleCountByCategory.get(category.slug) ?? 0} article
                  {(articleCountByCategory.get(category.slug) ?? 0) === 1 ? '' : 's'} →
                </p>
              </Link>
            ))}
          </div>
        </InfoSection>
      ) : null}

      {articles.data.length > 0 ? (
        <InfoSection title="All guides" id="articles">
          <InfoLinkList
            items={articles.data.map((article) => ({
              label: article.title,
              href: `/docs/${article.slug}`,
              note: article.description ?? undefined,
            }))}
          />
        </InfoSection>
      ) : null}

      <InfoSection title="Search" id="search">
        <p>
          Looking for something specific? Use the search page to find guides by keyword:{' '}
          <Link href="/docs/search" className="font-medium text-accent hover:text-accent-strong">
            Search the Knowledge Base
          </Link>
          .
        </p>
      </InfoSection>

      <InfoSection title="How Ravelyth works" id="about">
        <InfoLinkList
          items={[
            { label: 'Documentation & tool limits', href: '/docs/about', note: 'What the tools measure and what they do not claim.' },
            { label: 'FAQ', href: '/faq' },
            { label: 'DNS guides', href: '/guides/dns' },
            { label: 'Email authentication guides', href: '/guides/email' },
          ]}
        />
      </InfoSection>
    </InfoPage>
  );
}
