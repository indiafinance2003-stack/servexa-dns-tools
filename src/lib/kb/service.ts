import { and, asc, desc, eq, ne, or, sql } from 'drizzle-orm';
import { dbFromRequest } from '@/lib/db/request';
import { kbArticles, kbCategories } from '@/lib/db/schema';
import { KB_ARTICLES, KB_CATEGORIES, type KbArticleContent } from './content';

/**
 * Knowledge Base service.
 *
 * The authored content in `content.ts` is the editorial source; this module
 * seeds it into PostgreSQL and reads it back with publication filtering. The
 * DATABASE is the authority for what is public: unpublishing, editing and
 * drafts happen there (Part 4 admin room), never by redeploying code.
 *
 * Guarantees:
 *  - public reads return ONLY rows with status 'published';
 *  - seeding is idempotent (upsert by slug) and never deletes anything;
 *  - when the database is unavailable, reads fail soft (empty results +
 *    `available: false`) so the public site never crashes.
 */

export interface PublicKbCategory {
  slug: string;
  title: string;
  description: string | null;
  articleCount: number;
}

export interface PublicKbArticle {
  slug: string;
  categorySlug: string;
  title: string;
  description: string | null;
  featured: boolean;
  readingTimeMinutes: number | null;
  publishedAt: string | null;
  updatedAt: string | null;
}

export interface PublicKbArticleDetail extends PublicKbArticle {
  bodyJson: KbArticleContent['sections'] | null;
  body: string;
  relatedTools: Array<{ label: string; href: string }>;
  relatedArticles: Array<{ slug: string; title: string }>;
}

export interface KbReadResult<T> {
  available: boolean;
  data: T;
}

let seedVerified = false;

/**
 * Idempotent seed of authored KB content. Safe to call on every cold start:
 * existing rows are updated in place (never deleted), customer/admin changes to
 * publication status are preserved by only touching content fields.
 */
export async function seedKbContent(): Promise<{ categories: number; articles: number }> {
  const { db } = dbFromRequest();

  for (const category of KB_CATEGORIES) {
    await db
      .insert(kbCategories)
      .values({
        slug: category.slug,
        title: category.title,
        description: category.description,
        sortOrder: category.sortOrder,
      })
      .onConflictDoUpdate({
        target: kbCategories.slug,
        set: {
          title: category.title,
          description: category.description,
          sortOrder: category.sortOrder,
        },
      });
  }

  const categoryRows = await db
    .select({ id: kbCategories.id, slug: kbCategories.slug })
    .from(kbCategories);
  const categoryIdBySlug = new Map(categoryRows.map((row) => [row.slug, row.id]));

  let articleCount = 0;
  for (const article of KB_ARTICLES) {
    const categoryId = categoryIdBySlug.get(article.categorySlug);
    if (!categoryId) continue;
    await db
      .insert(kbArticles)
      .values({
        categoryId,
        slug: article.slug,
        title: article.title,
        description: article.description,
        status: 'published',
        body: article.sections.map((section) => section.heading).join('\n\n'),
        bodyJson: article.sections,
        relatedTools: article.relatedTools,
        relatedArticles: article.relatedArticles,
        featured: article.featured ?? false,
        readingTimeMinutes: article.readingTimeMinutes,
        publishedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: kbArticles.slug,
        set: {
          categoryId,
          title: article.title,
          description: article.description,
          body: article.sections.map((section) => section.heading).join('\n\n'),
          bodyJson: article.sections,
          relatedTools: article.relatedTools,
          relatedArticles: article.relatedArticles,
          featured: article.featured ?? false,
          readingTimeMinutes: article.readingTimeMinutes,
          updatedAt: new Date(),
        },
      });
    articleCount += 1;
  }

  seedVerified = true;
  return { categories: KB_CATEGORIES.length, articles: articleCount };
}

/**
 * Ensures the KB tables have the authored content. Runs at most once per
 * server process; failures are swallowed so a read-only or unreachable
 * database degrades to the "unavailable" state instead of crashing a page.
 */
export async function ensureKbSeeded(): Promise<void> {
  if (seedVerified) return;
  try {
    await seedKbContent();
  } catch {
    // Database unavailable (or migration not applied yet). Public pages render
    // their empty/unavailable state; the next request retries the seed.
  }
}

/** Public categories with published-article counts. */
export async function listPublicCategories(): Promise<KbReadResult<PublicKbCategory[]>> {
  await ensureKbSeeded();
  try {
    const { db } = dbFromRequest();
    const rows = await db
      .select({
        slug: kbCategories.slug,
        title: kbCategories.title,
        description: kbCategories.description,
        sortOrder: kbCategories.sortOrder,
        articleCount: sql<number>`count(${kbArticles.id}) filter (where ${kbArticles.status} = 'published')::int`,
      })
      .from(kbCategories)
      .leftJoin(kbArticles, eq(kbArticles.categoryId, kbCategories.id))
      .groupBy(kbCategories.id)
      .orderBy(asc(kbCategories.sortOrder));

    return {
      available: true,
      data: rows.map((row) => ({
        slug: row.slug,
        title: row.title,
        description: row.description,
        articleCount: row.articleCount,
      })),
    };
  } catch {
    return { available: false, data: [] };
  }
}

export interface ListPublicArticlesOptions {
  categorySlug?: string;
  featuredOnly?: boolean;
  limit?: number;
  excludeSlug?: string;
}

/** Public article listing — published rows only. */
export async function listPublicArticles(
  options: ListPublicArticlesOptions = {}
): Promise<KbReadResult<PublicKbArticle[]>> {
  await ensureKbSeeded();
  try {
    const { db } = dbFromRequest();
    const conditions = [eq(kbArticles.status, 'published')];
    if (options.categorySlug) {
      conditions.push(eq(kbCategories.slug, options.categorySlug));
    }
    if (options.featuredOnly) {
      conditions.push(eq(kbArticles.featured, true));
    }
    if (options.excludeSlug) {
      conditions.push(ne(kbArticles.slug, options.excludeSlug));
    }

    const rows = await db
      .select({
        slug: kbArticles.slug,
        categorySlug: kbCategories.slug,
        title: kbArticles.title,
        description: kbArticles.description,
        featured: kbArticles.featured,
        readingTimeMinutes: kbArticles.readingTimeMinutes,
        publishedAt: kbArticles.publishedAt,
        updatedAt: kbArticles.updatedAt,
      })
      .from(kbArticles)
      .innerJoin(kbCategories, eq(kbArticles.categoryId, kbCategories.id))
      .where(and(...conditions))
      .orderBy(desc(kbArticles.featured), desc(kbArticles.publishedAt))
      .limit(Math.min(Math.max(options.limit ?? 50, 1), 100));

    return {
      available: true,
      data: rows.map(toPublicArticle),
    };
  } catch {
    return { available: false, data: [] };
  }
}

function toPublicArticle(row: {
  slug: string;
  categorySlug: string;
  title: string;
  description: string | null;
  featured: boolean;
  readingTimeMinutes: number | null;
  publishedAt: Date | null;
  updatedAt: Date | null;
}): PublicKbArticle {
  return {
    slug: row.slug,
    categorySlug: row.categorySlug,
    title: row.title,
    description: row.description,
    featured: row.featured,
    readingTimeMinutes: row.readingTimeMinutes,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

/** Case-insensitive search over published article titles and descriptions. */
export async function searchPublicArticles(
  query: string
): Promise<KbReadResult<PublicKbArticle[]>> {
  const trimmed = query.trim().slice(0, 100);
  if (trimmed.length < 2) {
    return listPublicArticles({ limit: 50 });
  }
  await ensureKbSeeded();
  try {
    const { db } = dbFromRequest();
    const pattern = `%${trimmed.replace(/[%_\\]/g, (match) => `\\${match}`)}%`;
    const rows = await db
      .select({
        slug: kbArticles.slug,
        categorySlug: kbCategories.slug,
        title: kbArticles.title,
        description: kbArticles.description,
        featured: kbArticles.featured,
        readingTimeMinutes: kbArticles.readingTimeMinutes,
        publishedAt: kbArticles.publishedAt,
        updatedAt: kbArticles.updatedAt,
      })
      .from(kbArticles)
      .innerJoin(kbCategories, eq(kbArticles.categoryId, kbCategories.id))
      .where(
        and(
          eq(kbArticles.status, 'published'),
          or(
            sql`${kbArticles.title} ilike ${pattern}`,
            sql`${kbArticles.description} ilike ${pattern}`
          )
        )
      )
      .orderBy(desc(kbArticles.featured), desc(kbArticles.publishedAt))
      .limit(50);

    return { available: true, data: rows.map(toPublicArticle) };
  } catch {
    return { available: false, data: [] };
  }
}

/**
 * Fetches one published article by slug, with related published articles
 * resolved. Drafts and unpublished rows are invisible here (404 upstream).
 */
export async function getPublicArticle(
  slug: string
): Promise<KbReadResult<PublicKbArticleDetail | null>> {
  await ensureKbSeeded();
  try {
    const { db } = dbFromRequest();
    const rows = await db
      .select({
        slug: kbArticles.slug,
        categorySlug: kbCategories.slug,
        title: kbArticles.title,
        description: kbArticles.description,
        featured: kbArticles.featured,
        readingTimeMinutes: kbArticles.readingTimeMinutes,
        publishedAt: kbArticles.publishedAt,
        updatedAt: kbArticles.updatedAt,
        body: kbArticles.body,
        bodyJson: kbArticles.bodyJson,
        relatedTools: kbArticles.relatedTools,
        relatedArticleSlugs: kbArticles.relatedArticles,
      })
      .from(kbArticles)
      .innerJoin(kbCategories, eq(kbArticles.categoryId, kbCategories.id))
      .where(and(eq(kbArticles.slug, slug), eq(kbArticles.status, 'published')))
      .limit(1);

    const row = rows[0];
    if (!row) return { available: true, data: null };

    const detail: PublicKbArticleDetail = {
      ...toPublicArticle(row),
      body: row.body,
      bodyJson: (row.bodyJson as KbArticleContent['sections'] | null) ?? null,
      relatedTools: Array.isArray(row.relatedTools)
        ? (row.relatedTools as Array<{ label: string; href: string }>)
        : [],
      relatedArticles: [],
    };

    // Resolve related-article links, published rows only, in stored order.
    const relatedSlugs = Array.isArray(row.relatedArticleSlugs)
      ? (row.relatedArticleSlugs as unknown[]).filter(
          (value): value is string => typeof value === 'string' && value.length <= 100
        )
      : [];
    if (relatedSlugs.length > 0) {
      const relatedRows = await db
        .select({ slug: kbArticles.slug, title: kbArticles.title })
        .from(kbArticles)
        .where(
          and(
            eq(kbArticles.status, 'published'),
            sql`${kbArticles.slug} = any(${relatedSlugs})`
          )
        );
      const titleBySlug = new Map(relatedRows.map((item) => [item.slug, item.title]));
      for (const relatedSlug of relatedSlugs.slice(0, 6)) {
        const title = titleBySlug.get(relatedSlug);
        if (title) detail.relatedArticles.push({ slug: relatedSlug, title });
      }
    }

    return { available: true, data: detail };
  } catch {
    return { available: false, data: null };
  }
}

/** All published article slugs — used by the public sitemap. */
export async function listPublicArticleSlugs(): Promise<string[]> {
  try {
    const { db } = dbFromRequest();
    const rows = await db
      .select({ slug: kbArticles.slug })
      .from(kbArticles)
      .where(eq(kbArticles.status, 'published'));
    return rows.map((row) => row.slug);
  } catch {
    return [];
  }
}