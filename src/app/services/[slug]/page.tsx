import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { InfoPage, InfoSection } from '@/components/layout/info-page';
import { findService, SERVICE_DEFINITIONS } from '@/lib/plans/services';
import { formatPlanPrice, managedSupportPlan, isPlanPurchasable } from '@/lib/plans/catalog';
import { config } from '@/lib/config';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return SERVICE_DEFINITIONS.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = findService(slug);
  if (!service) return { title: 'Service not found' };
  const canonical = `${config.APP_URL}/services/${service.slug}`;
  return {
    title: service.title,
    description: service.summary,
    alternates: { canonical: `/services/${service.slug}` },
    openGraph: { title: service.title, description: service.summary, url: canonical },
    twitter: { card: 'summary', title: service.title, description: service.summary },
  };
}

export default async function ServicePage({ params }: PageProps): Promise<React.ReactElement> {
  const { slug } = await params;
  const service = findService(slug);
  if (!service) notFound();

  const plan = managedSupportPlan();
  const purchasable = isPlanPurchasable(plan);

  return (
    <InfoPage title={service.title} intro={service.summary}>
      <InfoSection title="What this covers" id="covers">
        <ul className="list-disc space-y-2 pl-5">
          {service.includes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </InfoSection>

      <InfoSection title="What this does not cover" id="boundaries">
        <ul className="list-disc space-y-2 pl-5">
          {service.excludes.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-sm text-slate-400">
          Work beyond this scope may be possible as a separately quoted technical service — ask through the
          support request form and we will say clearly whether it is something we can do.
        </p>
      </InfoSection>

      <InfoSection title="Information to have ready" id="collect">
        <ul className="list-disc space-y-2 pl-5">
          {service.collect.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="text-sm text-slate-400">
          You can run the free diagnostic tools below first and attach a summary of the findings to your request —
          it usually shortens the investigation.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          {service.relatedTools.map((tool) => (
            <li key={tool.href}>
              <Link href={tool.href} className="font-medium text-accent hover:text-accent-strong">
                {tool.label}
              </Link>
            </li>
          ))}
        </ul>
      </InfoSection>

      <InfoSection title="Related guides" id="guides">
        <ul className="list-disc space-y-2 pl-5">
          {service.relatedArticles.map((articleSlug) => (
            <li key={articleSlug}>
              <Link
                href={`/docs/${articleSlug}`}
                className="font-medium text-accent hover:text-accent-strong"
              >
                Open guide
              </Link>
            </li>
          ))}
        </ul>
      </InfoSection>

      <InfoSection title="How to get this service" id="get-started">
        <p>
          This service is delivered through{' '}
          <span className="font-medium text-ink">Ravelyth Managed Support</span> at{' '}
          <span className="font-medium text-ink">{formatPlanPrice(plan.price)}</span>. Requests are handled as
          tickets in your customer portal, with diagnostics context attached.
        </p>
        <p>
          {purchasable ? (
            <>
              Subscribe on the{' '}
              <Link href="/pricing" className="font-medium text-accent hover:text-accent-strong">
                pricing page
              </Link>{' '}
              — once your subscription is active the support queue opens in your portal.
            </>
          ) : (
            <>
              Online subscription is not available yet (the billing integration is pending), so please use the{' '}
              <Link href="/support/request" className="font-medium text-accent hover:text-accent-strong">
                support request form
              </Link>{' '}
              and we will respond with the current sign-up process. No payment is taken through this website at
              the moment.
            </>
          )}
        </p>
        <p className="text-sm text-slate-400">
          Need this specific problem looked at first?{' '}
          <Link href="/support/request" className="font-medium text-accent hover:text-accent-strong">
            Send a support request
          </Link>{' '}
          — the free diagnostics and Knowledge Base remain available to everyone.
        </p>
      </InfoSection>
    </InfoPage>
  );
}