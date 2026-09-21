import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage, InfoSection } from '@/components/layout/info-page';
import { SERVICE_DEFINITIONS } from '@/lib/plans/services';

export const metadata: Metadata = {
  title: 'Managed Services',
  description:
    'DNS management, email management, WordPress management, VPS basics, SSL/HTTPS and website migration — delivered through Ravelyth Managed Support.',
  alternates: { canonical: '/services' },
};

export default function Page(): React.ReactElement {
  return (
    <InfoPage
      title="Managed Services"
      intro="Hands-on technical services delivered by Ravelyth through a Managed Support plan. Each page states exactly what is included and what is not."
    >
      <InfoSection title="Services" id="services">
        <div className="grid gap-4 sm:grid-cols-2">
          {SERVICE_DEFINITIONS.map((service) => (
            <div key={service.slug} className="rounded-lg border border-line p-4">
              <h3 className="font-semibold text-ink">
                <Link
                  href={`/services/${service.slug}`}
                  className="hover:text-accent"
                >
                  {service.title}
                </Link>
              </h3>
              <p className="mt-1 text-sm text-slate-400">{service.summary}</p>
            </div>
          ))}
        </div>
      </InfoSection>

      <InfoSection title="How delivery works" id="delivery">
        <p>
          All services are requested and tracked as support tickets in the customer portal. Diagnostics context
          from the free tools can be attached automatically. Work outside the published scope of a service is
          either declined or quoted separately — it is never silently assumed.
        </p>
        <p>
          <Link href="/pricing" className="font-medium text-accent hover:text-accent-strong">
            See Managed Support pricing
          </Link>{' '}
          or{' '}
          <Link href="/support/request" className="font-medium text-accent hover:text-accent-strong">
            send a support request
          </Link>
          .
        </p>
      </InfoSection>
    </InfoPage>
  );
}