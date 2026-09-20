import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { InfoPage } from '@/components/layout/info-page';
import { KbSectionView, KbArticleLinks } from '@/components/kb/kb-sections';
import { getPublicArticle } from '@/lib/kb/service';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicArticle(slug);
  if (!result.available || !result.data) {
    return { title: 'Guide not found' };
  }
  const article = result.data;
  const canonical = `${config.APP_URL}/docs/${article.slug}`;
  return {
    title: article.title,
    description: article.description ?? undefined,
    alternates: { canonical: `/docs/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.description ?? undefined,
      url: canonical,
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title: article.title,
      description: article.description ?? undefined,
    },
  };
}

export default async function ArticlePage({ params }: PageProps): Promise<React.ReactElement> {
  const { slug } = await params;

  // Slug format guard: anything unexpected is simply not found.
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) notFound();

  const result = await getPublicArticle(slug);
  if (!result.available) {
    return (
      <InfoPage
        title="Knowledge Base temporarily unavailable"
        intro="The guides could not be loaded right now. Please try again shortly."
      >
        <p>
          <Link href="/docs" className="font-medium text-accent hover:text-accent-strong">
            Back to the Knowledge Base
          </Link>
        </p>
      </InfoPage>
    );
  }

  const article = result.data;
  if (!article) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link href="/" className="hover:text-accent">
          Home
        </Link>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        <Link href="/docs" className="hover:text-accent">
          Knowledge Base
        </Link>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        <span className="text-slate-800">{article.title}</span>
      </nav>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">{article.title}</h1>
      {article.description ? <p className="mt-3 text-lg text-muted">{article.description}</p> : null}
      <p className="mt-2 text-sm text-slate-500">
        {article.readingTimeMinutes ? `${article.readingTimeMinutes} min read` : null}
        {article.readingTimeMinutes && article.updatedAt
          ? ' · '
          : null}
        {article.updatedAt ? `Updated ${new Date(article.updatedAt).toLocaleDateString()}` : null}
      </p>

      <div className="mt-8 space-y-6">
        {(article.bodyJson ?? []).map((section, index) => (
          <KbSectionView key={index} section={section} />
        ))}
        {article.bodyJson === null && article.body ? (
          <section className="rounded-xl border border-line bg-white p-6">
            <p className="whitespace-pre-wrap text-slate-700">{article.body}</p>
          </section>
        ) : null}
      </div>

      <div className="mt-8">
        <KbArticleLinks relatedTools={article.relatedTools} relatedArticles={article.relatedArticles} />
      </div>

      <p className="mt-8 text-sm text-slate-500">
        Stuck after following this guide?{' '}
        <Link href="/support/request" className="font-medium text-accent hover:text-accent-strong">
          Request support
        </Link>{' '}
        with your findings attached.
      </p>
    </div>
  );
}