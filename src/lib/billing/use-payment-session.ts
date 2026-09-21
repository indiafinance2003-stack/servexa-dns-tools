import { useCallback } from 'react';

/**
 * Thin client hook for the checkout API surface. All provider calls happen on
 * the server; the client only forwards session ids and the provider's payment
 * confirmation for server-side signature verification.
 */
export function usePaymentSession(): {
  startCheckout: () => Promise<string>;
  verifyPayment: (confirmation: {
    checkoutSessionId: string;
    providerPaymentId: string;
    providerOrderId: string;
    signature: string;
  }) => Promise<void>;
  cancelCheckout: (checkoutSessionId: string) => Promise<void>;
} {
  const startCheckout = useCallback(async (): Promise<string> => {
    const response = await fetch('/api/billing/checkout', { method: 'POST' });
    const payload = (await response.json()) as {
      success: boolean;
      data?: { id?: string };
      error?: { message?: string };
    };
    if (!response.ok || !payload.success || !payload.data?.id) {
      throw new Error(payload.error?.message ?? 'Checkout could not be started.');
    }
    return payload.data.id;
  }, []);

  const verifyPayment = useCallback(
    async (confirmation: {
      checkoutSessionId: string;
      providerPaymentId: string;
      providerOrderId: string;
      signature: string;
    }): Promise<void> => {
      const response = await fetch('/api/billing/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmation),
      });
      const payload = (await response.json()) as {
        success: boolean;
        error?: { message?: string };
      };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message ?? 'Payment could not be verified.');
      }
    },
    []
  );

  const cancelCheckout = useCallback(async (checkoutSessionId: string): Promise<void> => {
    await fetch('/api/billing/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkoutSessionId }),
    });
  }, []);

  return { startCheckout, verifyPayment, cancelCheckout };
}