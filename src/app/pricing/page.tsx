import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage, InfoSection } from '@/components/layout/info-page';
import {
  formatPlanPrice,
  isPlanPurchasable,
  managedSupportPlan,
  planCatalog,
} from '@/lib/plans/catalog';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Ravelyth Managed Support pricing: ₹599/month for hands-on DNS, email, WordPress and basic VPS support. Free diagnostic tools for everyone.',
  alternates: { canonical: '/pricing' },
};

export default function Page(): React.ReactElement {
  const plans = planCatalog();
  const supportPlan = managedSupportPlan();
  const purchasable = isPlanPurchasable(supportPlan);

  return (
    <InfoPage
      title="Pricing"
      intro="The diagnostic tools and Knowledge Base are free for everyone. Managed Support adds a human-backed ticket queue for DNS, email, WordPress and basic VPS work."
    >
      <div className="grid gap-6 md:grid-cols-2">
        {plans.map((plan) => (
          <section key={plan.id} className="rounded-xl border border-line bg-white p-6">
            <h2 className="text-xl font-semibold text-ink">{plan.name}</h2>
            <p className="mt-1 text-sm text-slate-600">{plan.summary}</p>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-ink">
              {formatPlanPrice(plan.price)}
            </p>
            <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <div className="mt-5">
              {plan.entitlement.managedSupport ? (
                purchasable ? (
                  <Link
                    href="/account/billing"
                    className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
                  >
                    Subscribe
                  </Link>
                ) : (
                  <Link
                    href="/support/request"
                    className="inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
                  >
                    Request Managed Support
                  </Link>
                )
              ) : (
                <span className="inline-block rounded-md border border-line px-4 py-2 text-sm font-medium text-slate-600">
                  Free — no account needed
                </span>
              )}
            </div>
          </section>
        ))}
      </div>

      <InfoSection title="What Managed Support does not include" id="boundaries">
        <ul className="list-disc space-y-2 pl-5">
          {supportPlan.boundaries.map((boundary) => (
            <li key={boundary}>{boundary}</li>
          ))}
        </ul>
      </InfoSection>

      <InfoSection title="Billing status" id="billing-status">
        <p>
          {purchasable ? (
            <>Online subscription and payment are available through this website.</>
          ) : (
            <>
              <span className="font-medium text-ink">Online billing is not connected yet.</span> No payment can
              currently be taken through this website, and no subscription is created or charged automatically.
              Use the{' '}
              <Link href="/support/request" className="font-medium text-accent hover:text-accent-strong">
                support request form
              </Link>{' '}
              and we will arrange Managed Support directly and transparently.
            </>
          )}
        </p>
        <p className="text-sm text-slate-600">
          When billing is enabled, subscriptions will appear in your portal with plan status, billing period and
          invoices — created only from real payment records.
        </p>
      </InfoSection>

      <InfoSection title="Links" id="links">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <Link href="/services" className="font-medium text-accent hover:text-accent-strong">
              Managed services and scope
            </Link>
          </li>
          <li>
            <Link href="/docs" className="font-medium text-accent hover:text-accent-strong">
              Knowledge Base
            </Link>
          </li>
        </ul>
      </InfoSection>
    </InfoPage>
  );
}