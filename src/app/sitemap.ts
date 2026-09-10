import type { MetadataRoute } from 'next';
import { config } from '@/lib/config';

const paths = [
  '/',
  '/dns/lookup',
  '/dns/analyze',
  '/dns/spf',
  '/dns/dkim',
  '/dns/dmarc',
  '/dns/ptr',
  '/dns/resolvers',
  '/email/analyze',
  '/docs',
  '/about',
];

export default function sitemap(): MetadataRoute.Sitemap {
  return paths.map((path) => ({
    url: `${config.APP_URL}${path}`,
    changeFrequency: 'weekly',
    priority: path === '/' ? 1 : 0.7,
  }));
}
