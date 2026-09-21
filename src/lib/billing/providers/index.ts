import { getPaymentProviderConfig } from './config';
import { razorpayProvider } from './razorpay';
import type { BillingProvider } from './types';

export {
  getPaymentProviderConfig,
  isPaymentConfigured,
  billingIntegrationPending,
} from './config';
export type {
  BillingProvider,
  CreatedOrder,
  CreateOrderInput,
  PaymentConfirmation,
  VerifiedPayment,
  WebhookEvent,
} from './types';
export {
  BillingProviderError,
  BillingVerificationError,
  BillingWebhookSignatureError,
} from './types';
export { razorpayProvider, sha256Hex } from './razorpay';

/**
 * The active billing provider, or null when the integration is not live.
 * Callers must treat null as "no payments can be accepted" and never fabricate
 * a success.
 */
export function getBillingProvider(): BillingProvider | null {
  return getPaymentProviderConfig() ? razorpayProvider : null;
}