import type { MetadataRoute } from 'next';
import { config } from '@/lib/config';

// Every URL listed here corresponds to an actual public page. Authentication
// and account pages are intentionally excluded (they are noindex utility
// pages, and /account requires a session).
const toolPaths = [
  '/dns/lookup',
  '/dns/analyze',
  '/dns/spf',
  '/dns/dkim',
  '/dns/dmarc',
  '/dns/ptr',
  '/dns/resolvers',
  '/email/analyze',
];

const infoPaths = [
  '/docs',
  '/about',
  '/guides/dns',
  '/guides/email',
  '/faq',
  '/privacy',
  '/terms',
  '/security',
  '/contact',
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${config.APP_URL}/`, changeFrequency: 'weekly', priority: 1 },
    ...toolPaths.map((path) => ({
      url: `${config.APP_URL}${path}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...infoPaths.map((path) => ({
      url: `${config.APP_URL}${path}`,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    })),
  ];
}
