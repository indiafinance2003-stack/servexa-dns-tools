import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/require-user';
import { getCheckoutSession } from '@/lib/billing/checkout';
import { RazorpayCheckout } from '@/components/billing/razorpay-checkout';
import { StartCheckoutButton } from '@/components/billing/start-checkout-button';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Complete your Managed Support subscription checkout.',
  robots: { index: false, follow: false },
};

function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}): Promise<React.ReactElement> {
  const user = await requireUser();
  const { sessionId } = await params;

  let session;
  try {
    session = await getCheckoutSession(user.id, sessionId);
  } catch {
    notFound();
  }

  const pending = session.status === 'pending';

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Complete checkout</h1>
      <p className="mt-1 text-sm text-slate-400">
        Managed Support · {formatMoney(session.amountMinor, session.currency)}
      </p>

      <section className="mt-8 rounded-xl border border-line bg-navy-surface p-6">
        {pending ? (
          <>
            <h2 className="text-lg font-semibold text-ink">{session.statusLabel}</h2>
            <p className="mt-2 text-sm text-slate-400">
              A secure payment order was prepared for this checkout. Click the button below to open
              the payment window and complete the purchase.
            </p>
            <div className="mt-6">
              {session.providerOrderIdForClient && session.providerKeyId ? (
                <RazorpayCheckout
                  sessionId={session.id}
                  providerOrderId={session.providerOrderIdForClient}
                  providerKeyId={session.providerKeyId}
                  amountMinor={session.amountMinor}
                  currency={session.currency}
                  customerName={user.name}
                  customerEmail={user.email}
                />
              ) : (
                <p className="text-sm text-amber-300">
                  The payment window is not ready for this session. Please go back and start checkout
                  again.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-md border border-line bg-navy-surface p-6 text-center">
            <p className="text-lg font-medium text-ink">
              {session.status === 'paid'
                ? 'Payment complete'
                : `Checkout ${session.statusLabel.toLowerCase()}`}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              {session.status === 'paid'
                ? 'Your subscription is being recorded and Managed Support will be available from your customer portal.'
                : 'This checkout was not completed. You can start a new one below.'}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3">
              {session.status === 'paid' ? (
                <Link
                  href="/account/billing"
                  className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong"
                >
                  View billing
                </Link>
              ) : (
                <StartCheckoutButton
                  label="Start a new checkout"
                  variant="primary"
                />
              )}
            </div>
          </div>
        )}
      </section>

      <p className="mt-6 text-sm text-slate-500">
        By completing checkout you agree that payment is processed by the configured provider and
        that this website never stores your card details.
      </p>
    </div>
  );
}