import type { Metadata } from 'next';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/require-user';
import { getCurrentSubscription, billingDisplayInfo, canPurchaseManagedSupport, subscriptionStatusLabel } from '@/lib/billing/subscriptions';
import { listInvoices } from '@/lib/billing/invoices';
import { getManagedSupportEntitlement, entitlementLabel } from '@/lib/support/entitlement';
import { AccountNav } from '@/components/account/account-nav';
import { StartCheckoutButton } from '@/components/billing/start-checkout-button';

export const metadata: Metadata = {
  title: 'Billing',
  description: 'Your Ravelyth billing and subscription status.',
  robots: { index: false, follow: false },
};

function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(iso));
}

export default async function BillingPage(): Promise<React.ReactElement> {
  const user = await requireUser();

  let subscription: Awaited<ReturnType<typeof getCurrentSubscription>> = null;
  let invoices: Awaited<ReturnType<typeof listInvoices>> = [];
  let entitlement: Awaited<ReturnType<typeof getManagedSupportEntitlement>> | null = null;
  let loadError: string | null = null;
  try {
    [subscription, invoices, entitlement] = await Promise.all([
      getCurrentSubscription(user.id),
      listInvoices(user.id),
      getManagedSupportEntitlement(user.id),
    ]);
  } catch {
    loadError = 'Billing information could not be loaded right now. Please try again shortly.';
  }

  const display = billingDisplayInfo();
  const purchasable = canPurchaseManagedSupport();
  const intervalLabel =
    display.interval === 'monthly' ? 'month' : display.interval === 'quarterly' ? 'quarter' : 'year';

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Billing</h1>
      <AccountNav entitled={entitlement?.entitled ?? false} />
      <BillingBody
        loadError={loadError}
        subscription={subscription}
        invoices={invoices}
        entitlement={entitlement}
        display={display}
        purchasable={purchasable}
        intervalLabel={intervalLabel}
      />
    </div>
  );
}

type BillingBodyProps = {
  loadError: string | null;
  subscription: Awaited<ReturnType<typeof getCurrentSubscription>>;
  invoices: Awaited<ReturnType<typeof listInvoices>>;
  entitlement: Awaited<ReturnType<typeof getManagedSupportEntitlement>> | null;
  display: ReturnType<typeof billingDisplayInfo>;
  purchasable: boolean;
  intervalLabel: string;
};

function BillingBody({
  loadError,
  subscription,
  invoices,
  entitlement,
  display,
  purchasable,
  intervalLabel,
}: BillingBodyProps): React.ReactElement {
  if (loadError) {
    return (
      <p role="alert" className="mt-8 rounded-md bg-red-500/10 p-3 text-sm text-red-300">
        {loadError}
      </p>
    );
  }

  return (
    <>
      <section className="mt-8 rounded-xl border border-line bg-navy-surface p-6">
        <h2 className="text-lg font-semibold text-ink">Current plan</h2>
        {subscription ? (
          <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-400">Plan</dt>
              <dd className="mt-0.5 font-medium text-ink">{subscription.planName}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Status</dt>
              <dd className="mt-0.5 font-medium text-ink">{subscriptionStatusLabel(subscription.status)}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Billing interval</dt>
              <dd className="mt-0.5 text-ink">{subscription.billingInterval}</dd>
            </div>
            <div>
              <dt className="text-slate-400">Recorded price</dt>
              <dd className="mt-0.5 text-ink">
                {subscription.priceMinor !== null
                  ? `${formatMoney(subscription.priceMinor, subscription.currency)} / ${intervalLabel}`
                  : 'Not recorded'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Current period</dt>
              <dd className="mt-0.5 text-ink">
                {formatDate(subscription.currentPeriodStart)} → {formatDate(subscription.currentPeriodEnd)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Payment provider reference</dt>
              <dd className="mt-0.5 text-ink">{subscription.providerLinked ? 'Recorded' : 'None'}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-slate-400">
            No subscription is recorded on your account. Every diagnostic tool and the Knowledge Base
            remain free; Managed Support is a separate plan.
          </p>
        )}
      </section>
      <ManagedSupportSection
        entitlement={entitlement}
        display={display}
        purchasable={purchasable}
        intervalLabel={intervalLabel}
      />
      <InvoiceSection invoices={invoices} />
    </>
  );
}

function ManagedSupportSection({
  entitlement,
  display,
  purchasable,
  intervalLabel,
}: {
  entitlement: Awaited<ReturnType<typeof getManagedSupportEntitlement>> | null;
  display: ReturnType<typeof billingDisplayInfo>;
  purchasable: boolean;
  intervalLabel: string;
}): React.ReactElement {
  return (
    <section className="mt-4 rounded-xl border border-line bg-navy-surface p-6">
      <h2 className="text-lg font-semibold text-ink">Managed Support</h2>
      <p className="mt-2 text-sm text-slate-400">
        {display.planName} — {formatMoney(display.amountMinor, display.currency)} per {intervalLabel}.
        {entitlement ? (
          <>
            {' '}
            Your entitlement status:{' '}
            <span className="font-medium text-ink">{entitlementLabel(entitlement.status)}</span>
            {entitlement.status !== 'entitled' ? ` — ${entitlement.reason}` : ''}
          </>
        ) : null}
      </p>
      {purchasable ? (
        <div className="mt-4 space-y-3">
          {entitlement?.entitled ? (
            <p className="text-sm text-emerald-300">
              Managed Support is active on your account, so no new purchase is needed.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-300">
                You can subscribe now. Payment is created and verified through the configured
                provider; your subscription appears here only after the payment is verified
                server-side.
              </p>
              <StartCheckoutButton label="Subscribe now" />
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 rounded-md bg-amber-500/10 p-3 text-sm text-amber-300">
          <p className="font-medium">Billing integration is pending.</p>
          <p className="mt-1">
            No payment provider is connected, so no subscription can be purchased or charged through this
            website and no invoice is generated. To arrange {display.planName}, use the{' '}
            <Link href="/support/request" className="font-medium underline">
              support request form
            </Link>{' '}
            — plans are activated transparently and recorded in your account.
          </p>
        </div>
      )}
      <p className="mt-3 text-sm text-slate-400">
        See the public{' '}
        <Link href="/pricing" className="font-medium text-accent hover:text-accent-strong">
          pricing page
        </Link>{' '}
        for exactly what the plan includes and does not include.
      </p>
    </section>
  );
}

function InvoiceSection({
  invoices,
}: {
  invoices: Awaited<ReturnType<typeof listInvoices>>;
}): React.ReactElement {
  return (
    <section className="mt-4 rounded-xl border border-line bg-navy-surface p-6">
      <h2 className="text-lg font-semibold text-ink">Invoices</h2>
      {invoices.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          No invoices exist for your account. Ravelyth never creates placeholder or simulated invoices —
          an invoice appears here only after a real billing record exists.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">Invoice</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Amount</th>
                <th className="py-2 pr-4">Issued</th>
                <th className="py-2">Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="py-2 pr-4 font-mono text-xs text-ink">{invoice.invoiceNumber}</td>
                  <td className="py-2 pr-4 text-ink">{invoice.statusLabel}</td>
                  <td className="py-2 pr-4 text-ink">{invoice.amountFormatted}</td>
                  <td className="py-2 pr-4 text-ink">{formatDate(invoice.issuedAt)}</td>
                  <td className="py-2 text-ink">{formatDate(invoice.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
