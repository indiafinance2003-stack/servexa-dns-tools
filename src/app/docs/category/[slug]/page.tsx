import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { InfoPage, InfoSection, InfoLinkList } from '@/components/layout/info-page';
import { listPublicCategories, listPublicArticles } from '@/lib/kb/service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const categories = await listPublicCategories();
  const category = categories.data.find((item) => item.slug === slug);
  if (!category) return {};
  return {
    title: category.title,
    description: category.description ?? undefined,
    alternates: { canonical: `/docs/category/${slug}` },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<React.ReactElement> {
  const { slug } = await params;
  const categories = await listPublicCategories();
  const category = categories.data.find((item) => item.slug === slug);
  if (!category) notFound();

  const articles = await listPublicArticles({ categorySlug: slug });

  return (
    <InfoPage title={category.title} intro={category.description ?? undefined}>
      <InfoSection title="Guides in this topic" id="articles">
        {articles.data.length > 0 ? (
          <InfoLinkList
            items={articles.data.map((article) => ({
              label: article.title,
              href: `/docs/${article.slug}`,
              note:
                article.description ??
                (article.readingTimeMinutes ? `${article.readingTimeMinutes} min read` : undefined),
            }))}
          />
        ) : (
          <p>No published guides exist in this topic yet.</p>
        )}
      </InfoSection>

      <InfoSection title="All topics" id="other-categories">
        <ul className="list-disc space-y-1 pl-5">
          {categories.data
            .filter((item) => item.slug !== slug)
            .map((item) => (
              <li key={item.slug}>
                <Link
                  href={`/docs/category/${item.slug}`}
                  className="font-medium text-accent hover:text-accent-strong"
                >
                  {item.title}
                </Link>
              </li>
            ))}
        </ul>
        <p className="mt-3">
          <Link href="/docs" className="font-medium text-accent hover:text-accent-strong">
            Browse the whole Knowledge Base
          </Link>
        </p>
      </InfoSection>
    </InfoPage>
  );
}