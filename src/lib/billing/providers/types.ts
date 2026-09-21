/**
 * Billing provider contract.
 *
 * The application only ever trusts three provider outputs:
 *   1. the order/session created server-side (id + quoted amount),
 *   2. a server-side payment signature verification, and
 *   3. a signed webhook event.
 *
 * There is deliberately NO "payment succeeded" provider call from the client —
 * the browser can only report a payment it initiated; the signature check is
 * what makes that report trustworthy.
 */

/** Input to create a checkout order at the provider. */
export interface CreateOrderInput {
  /** The session's internal id, echoed by the provider as the receipt. */
  receipt: string;
  /** Amount in minor units (paise for INR). */
  amountMinor: number;
  currency: string;
  /** Monotonically useful reference for the provider dashboard. */
  note: string;
}

export interface CreatedOrder {
  /** Provider order id (e.g. order_JXXXX...). */
  providerOrderId: string;
  /** Raw provider reference for audit purposes only. */
  receipt: string;
}

/** Payload the browser returns after the customer completes payment. */
export interface PaymentConfirmation {
  providerPaymentId: string;
  providerOrderId: string;
  /** Provider signature over `${orderId}|${paymentId}`. */
  signature: string;
}

export interface VerifiedPayment {
  providerPaymentId: string;
  providerOrderId: string;
  /** When the provider explicitly reported the event (webhook). */
  event?: string;
}

/** A webhook event the provider delivered to the server. */
export interface WebhookEvent {
  event: string;
  /** Verified (non-fabricated) payload from the provider. */
  payload: Record<string, unknown>;
}

export interface BillingProvider {
  readonly name: 'razorpay';
  /**
   * Creates a fresh order at the provider. Should be called AFTER the checkout
   * session row is persisted so the receipt can reference the real row id.
   */
  createOrder(input: CreateOrderInput): Promise<CreatedOrder>;
  /**
   * Verifies a payment confirmation signature. Returns the verified payment on
   * success; throws BillingVerificationError otherwise.
   */
  verifyPayment(confirmation: PaymentConfirmation, expected?: { amountMinor: number; currency: string }): Promise<VerifiedPayment>;
  /**
   * Verifies a webhook delivery against the shared webhook secret, returning
   * the parsed event. Unknown-signature deliveries are rejected.
   */
  verifyWebhook(rawBody: string, signatureHeader: string | null): Promise<WebhookEvent>;
}

export class BillingProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BillingProviderError';
  }
}

export class BillingVerificationError extends BillingProviderError {
  constructor(message: string) {
    super(message);
    this.name = 'BillingVerificationError';
  }
}

export class BillingWebhookSignatureError extends BillingProviderError {
  constructor() {
    super('Webhook signature verification failed.');
    this.name = 'BillingWebhookSignatureError';
  }
}