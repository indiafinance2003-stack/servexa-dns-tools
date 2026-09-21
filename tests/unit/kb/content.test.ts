import { describe, expect, it } from 'vitest';
import { KB_ARTICLES, KB_CATEGORIES } from '@/lib/kb/content';

/**
 * KB content is the editorial source seeded into the database
 * (src/lib/kb/service.ts). These tests guard structural integrity so a bad
 * edit can never go out with a deploy: unique slugs, every article in a real
 * category, every cross-reference resolving, and no slug that collides with a
 * static docs route.
 */

describe('KB categories', () => {
  it('defines the expected set with unique slugs and ordering', () => {
    expect(KB_CATEGORIES.length).toBe(6);
    const slugs = KB_CATEGORIES.map((category) => category.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const category of KB_CATEGORIES) {
      expect(category.title.length).toBeGreaterThan(0);
      expect(category.description.length).toBeGreaterThan(0);
      expect(category.sortOrder).toBeGreaterThan(0);
    }
  });

  it('keeps slugs stable so database rows are upserted onto the same keys', () => {
    expect(KB_CATEGORIES.map((category) => category.slug).sort()).toEqual(
      [
        'dns-and-nameservers',
        'email-authentication',
        'email-delivery',
        'servers-and-ssl',
        'using-ravelyth',
        'wordpress-websites',
      ].sort()
    );
  });
});

describe('KB articles', () => {
  const slugs = KB_ARTICLES.map((article) => article.slug);
  const categorySlugs = new Set(KB_CATEGORIES.map((category) => category.slug));
  const bySlug = new Map(KB_ARTICLES.map((article) => [article.slug, article]));

  it('contains articles across every category with unique slugs', () => {
    expect(KB_ARTICLES.length).toBe(21);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('places every article in a defined category and never publishes an empty article', () => {
    for (const article of KB_ARTICLES) {
      expect(categorySlugs.has(article.categorySlug)).toBe(true);
      expect(article.title.trim().length).toBeGreaterThan(0);
      expect(article.description.trim().length).toBeGreaterThan(0);
      expect(article.readingTimeMinutes).toBeGreaterThan(0);
      expect(article.sections.length).toBeGreaterThan(0);
      for (const section of article.sections) {
        expect(section.heading.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps related-tool links internal to the application', () => {
    for (const article of KB_ARTICLES) {
      for (const tool of article.relatedTools) {
        expect(tool.label.trim().length).toBeGreaterThan(0);
        expect(tool.href).toMatch(/^\//);
        expect(tool.href).not.toMatch(/^(https?:)?\/\//);
      }
    }
  });

  it('resolves every related-article reference to an actual article', () => {
    for (const article of KB_ARTICLES) {
      for (const related of article.relatedArticles) {
        expect(bySlug.has(related), `${article.slug} references a missing article ${related}`).toBe(true);
      }
    }
  });

  it('does not reuse a slug that collides with a static docs route', () => {
    // /docs/about is a static page (src/app/docs/about), not an article slug.
    expect(slugs).not.toContain('about');
    expect(slugs).not.toContain('categories');
  });

  it('only features articles that exist', () => {
    for (const article of KB_ARTICLES) {
      if (article.featured) {
        expect(slugs).toContain(article.slug);
      }
    }
  });
});