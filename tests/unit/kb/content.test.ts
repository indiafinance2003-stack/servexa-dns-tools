import { describe, expect, it } from 'vitest';
import { KB_ARTICLES, KB_CATEGORIES } from '@/lib/kb/content';
import { SERVICE_DEFINITIONS } from '@/lib/plans/services';

const categorySlugs = new Set(KB_CATEGORIES.map((category) => category.slug));
const articleSlugs = new Set(KB_ARTICLES.map((article) => article.slug));
const serviceArticleReferences = new Set(
  SERVICE_DEFINITIONS.flatMap((service) => service.relatedArticles)
);

describe('Knowledge Base authored content integrity', () => {
  it('has unique category slugs', () => {
    expect(categorySlugs.size).toBe(KB_CATEGORIES.length);
  });

  it('has unique article slugs', () => {
    expect(articleSlugs.size).toBe(KB_ARTICLES.length);
  });

  it('references only existing categories', () => {
    for (const article of KB_ARTICLES) {
      expect(categorySlugs.has(article.categorySlug)).toBe(true);
    }
  });

  it('references only existing related articles', () => {
    for (const article of KB_ARTICLES) {
      for (const related of article.relatedArticles) {
        expect(articleSlugs.has(related)).toBe(true);
      }
    }
  });

  it('keeps service pages pointing at real guides', () => {
    for (const slug of serviceArticleReferences) {
      expect(articleSlugs.has(slug)).toBe(true);
    }
  });

  it('publishes a positive reading time for every article', () => {
    for (const article of KB_ARTICLES) {
      expect(article.readingTimeMinutes).toBeGreaterThan(0);
    }
  });

  it('gives every section a heading and a valid kind', () => {
    for (const article of KB_ARTICLES) {
      expect(article.sections.length).toBeGreaterThan(0);
      for (const section of article.sections) {
        expect(section.heading.length).toBeGreaterThan(0);
        expect(['text', 'list', 'steps', 'code']).toContain(section.kind);
      }
    }
  });

  it('links related tools to internal routes only', () => {
    for (const article of KB_ARTICLES) {
      for (const tool of article.relatedTools) {
        expect(tool.href.startsWith('/')).toBe(true);
        expect(tool.href.startsWith('//')).toBe(false);
      }
    }
  });

  it('covers the core diagnostic topics', () => {
    const slugs = [...articleSlugs];
    const requiredTopics = [
      'dns-propagation-not-updating',
      'nameserver-change-checklist',
      'email-delivery-issues',
    ];
    for (const topic of requiredTopics) {
      expect(slugs).toContain(topic);
    }
  });
});
