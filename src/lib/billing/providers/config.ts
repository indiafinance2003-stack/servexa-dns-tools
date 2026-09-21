import { config } from '@/lib/config';

/**
 * Payment provider configuration.
 *
 * Razorpay is CONFIGURED only when the provider name matches AND every
 * credential required to create orders and verify payments is present. Any
 * missing value means the integration is NOT live: the application must then
 * refuse checkout and never report a successful payment.
 */

export interface PaymentProviderConfig {
  provider: 'razorpay';
  /** Public key id (sent to the browser to render the checkout UI). */
  keyId: string;
  /** Secret used to create orders server-side. */
  keySecret: string;
  /** Secret used to verify webhook signatures. */
  webhookSecret: string;
}

export function getPaymentProviderConfig(): PaymentProviderConfig | null {
  if (config.BILLING_PROVIDER !== 'razorpay') return null;
  if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET || !config.RAZORPAY_WEBHOOK_SECRET) {
    return null;
  }
  return {
    provider: 'razorpay',
    keyId: config.RAZORPAY_KEY_ID,
    keySecret: config.RAZORPAY_KEY_SECRET,
    webhookSecret: config.RAZORPAY_WEBHOOK_SECRET,
  };
}

/** True only when real, verifiable payments can be accepted right now. */
export function isPaymentConfigured(): boolean {
  return getPaymentProviderConfig() !== null;
}

/** The pricing/UI layer gate: never advertise checkout when unconfigured. */
export function billingIntegrationPending(): boolean {
  return config.BILLING_PROVIDER.length === 0 || !isPaymentConfigured();
}