import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { getPaymentProviderConfig } from './config';
import {
  BillingProvider,
  BillingProviderError,
  BillingVerificationError,
  BillingWebhookSignatureError,
  CreatedOrder,
  CreateOrderInput,
  PaymentConfirmation,
  VerifiedPayment,
  WebhookEvent,
} from './types';

const RAZORPAY_ORDER_API = 'https://api.razorpay.com/v1/orders';

function hmacHex(secret: string, data: string | Buffer): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

function safeEqualHex(actual: string, expected: string): boolean {
  const a = Buffer.from(actual, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Razorpay payment signature over `orderId|paymentId` (HMAC-SHA256 with the
 * KEY secret). Pure and exported so the exact contract is unit tested.
 */
export function razorpayPaymentSignature(orderId: string, paymentId: string, secret: string): string {
  return hmacHex(secret, `${orderId}|${paymentId}`);
}

/**
 * Razorpay webhook signature over the RAW body (HMAC-SHA256 with the WEBHOOK
 * secret). Pure and exported so the exact contract is unit tested.
 */
export function razorpayWebhookSignature(rawBody: string, webhookSecret: string): string {
  return hmacHex(webhookSecret, rawBody);
}

function requireConfig() {
  const cfg = getPaymentProviderConfig();
  if (!cfg) {
    throw new BillingProviderError('The payment provider is not configured.');
  }
  return cfg;
}

/**
 * Razorpay implementation.
 *
 * - Order creation uses HTTP Basic auth with the key credentials — the secret
 *   never reaches the browser.
 * - Payment signatures use HMAC-SHA256 over `order_id|payment_id` with the key
 *   secret, compared in constant time.
 * - Webhooks use HMAC-SHA256 over the raw request body with the webhook
 *   secret, compared in constant time.
 */
export const razorpayProvider: BillingProvider = {
  name: 'razorpay',

  async createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
    const cfg = requireConfig();
    const auth = Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64');

    let response: Response;
    try {
      response = await fetch(RAZORPAY_ORDER_API, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: input.amountMinor,
          currency: input.currency,
          receipt: input.receipt,
          notes: { note: input.note },
          payment_capture: 1,
        }),
      });
    } catch {
      throw new BillingProviderError('Could not reach the payment provider. Please try again later.');
    }

    if (!response.ok) {
      throw new BillingProviderError('The payment provider rejected the order request.');
    }

    let json: { id?: string; receipt?: string } = {};
    try {
      json = (await response.json()) as { id?: string; receipt?: string };
    } catch {
      throw new BillingProviderError('The payment provider returned a malformed order response.');
    }

    if (typeof json.id !== 'string' || json.id.length === 0) {
      throw new BillingProviderError('The payment provider did not return an order id.');
    }

    return {
      providerOrderId: json.id,
      receipt: json.receipt ?? input.receipt,
    };
  },

  async verifyPayment(
    confirmation: PaymentConfirmation,
    _expected?: { amountMinor: number; currency: string }
  ): Promise<VerifiedPayment> {
    const cfg = requireConfig();

    const { providerPaymentId, providerOrderId, signature } = confirmation;
    if (
      typeof providerPaymentId !== 'string' ||
      providerPaymentId.length === 0 ||
      typeof providerOrderId !== 'string' ||
      providerOrderId.length === 0 ||
      typeof signature !== 'string' ||
      signature.length === 0
    ) {
      throw new BillingVerificationError('The payment confirmation is incomplete.');
    }

    const digest = razorpayPaymentSignature(providerOrderId, providerPaymentId, cfg.keySecret);
    if (!safeEqualHex(digest, signature)) {
      throw new BillingVerificationError('The payment signature could not be verified.');
    }

    // The signature proves the provider generated it for this order, but the
    // browser could still submit a different order's id. The caller re-checks
    // the stored session amount separately.
    return { providerPaymentId, providerOrderId };
  },

  async verifyWebhook(rawBody: string, signatureHeader: string | null): Promise<WebhookEvent> {
    const cfg = requireConfig();
    if (!signatureHeader) {
      throw new BillingWebhookSignatureError();
    }

    const digest = razorpayWebhookSignature(rawBody, cfg.webhookSecret);
    if (!safeEqualHex(signatureHeader, digest)) {
      throw new BillingWebhookSignatureError();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new BillingWebhookSignatureError();
    }

    const event = parsed as { event?: string; payload?: Record<string, unknown> };
    if (typeof event.event !== 'string') {
      throw new BillingWebhookSignatureError();
    }

    return {
      event: event.event,
      payload: (event.payload ?? {}) as Record<string, unknown>,
    };
  },
};

/** SHA-256 fingerprint helpers used for receipts and idempotency keys. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}