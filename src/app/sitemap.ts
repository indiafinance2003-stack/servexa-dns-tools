import type { MetadataRoute } from 'next';
import { config } from '@/lib/config';
import { serviceSlugs } from '@/lib/plans/services';
import { listPublicArticleSlugs } from '@/lib/kb/service';
import { listPublicJobs } from '@/lib/talent/public';

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
  '/pricing',
  '/services',
  '/about',
  '/guides/dns',
  '/guides/email',
  '/faq',
  '/privacy',
  '/terms',
  '/security',
  '/contact',
  // Ravelyth Talent — public recruitment pages (job detail pages are added
  // dynamically below from the published job list).
  '/talent',
  '/talent/jobs',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Published Knowledge Base articles and service detail pages are real public
  // pages. KB reads fail soft (empty list) when the database is unavailable so
  // the sitemap still renders.
  const articleSlugs = await listPublicArticleSlugs();
  const servicePathSlugs = serviceSlugs();

  // Publicly listed Talent jobs. Like the KB, this fails soft (empty list) so a
  // database outage can never take down the sitemap route.
  let talentJobCodes: string[] = [];
  try {
    talentJobCodes = (await listPublicJobs()).map((job) => job.jobCode);
  } catch {
    talentJobCodes = [];
  }

  return [
    { url: `${config.APP_URL}/`, changeFrequency: 'weekly', priority: 1 },
    ...toolPaths.map((path) => ({
      url: `${config.APP_URL}${path}`,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...servicePathSlugs.map((slug) => ({
      url: `${config.APP_URL}/services/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...articleSlugs.map((slug) => ({
      url: `${config.APP_URL}/docs/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    ...infoPaths.map((path) => ({
      url: `${config.APP_URL}${path}`,
      changeFrequency: 'monthly' as const,
      priority: 0.4,
    })),
    ...talentJobCodes.map((jobCode) => ({
      url: `${config.APP_URL}/talent/jobs/${jobCode}`,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  ];
}
