'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePaymentSession } from '@/lib/billing/use-payment-session';

interface StartCheckoutButtonProps {
  /** Label rendered on the button (pricing page, billing page). */
  label?: string;
  variant?: 'primary' | 'outline';
  className?: string;
}

/**
 * Starts a checkout for Managed Support. On success the customer is routed to
 * the checkout page which renders the provider payment UI — the provider order
 * is created only through the server API and never fabricated client-side.
 */
export function StartCheckoutButton({
  label = 'Subscribe with Managed Support',
  variant = 'primary',
  className = '',
}: StartCheckoutButtonProps): React.ReactElement {
  const router = useRouter();
  const { startCheckout } = usePaymentSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleClick = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const sessionId = await startCheckout();
      router.push(`/billing/checkout/${sessionId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout could not be started.');
    } finally {
      setBusy(false);
    }
  }, [busy, router, startCheckout]);

  const base =
    variant === 'primary'
      ? 'inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50'
      : 'inline-flex items-center justify-center rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-navy-surface disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={`${base} ${className}`}
      >
        {busy ? 'Preparing checkout…' : label}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}