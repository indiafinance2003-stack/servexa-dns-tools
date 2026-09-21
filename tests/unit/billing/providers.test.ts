import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  razorpayPaymentSignature,
  razorpayWebhookSignature,
  sha256Hex,
} from '@/lib/billing/providers/razorpay';
import { checkoutStatusLabel } from '@/lib/billing/checkout';

describe('billing/providers razorpay signatures', () => {
  it('computes the payment signature exactly as the provider does (orderId|paymentId)', () => {
    const secret = 'rzp_test_secret_123';
    const orderId = 'order_MOCK_ORDER_ID';
    const paymentId = 'pay_MOCK_PAYMENT_ID';
    const combined = `${orderId}|${paymentId}`;
    const expected = createHmac('sha256', secret).update(combined).digest('hex');

    expect(razorpayPaymentSignature(orderId, paymentId, secret)).toBe(expected);
  });

  it('produces different signatures for the same payment under different secrets', () => {
    const a = razorpayPaymentSignature('order_x', 'pay_y', 'secret_a');
    const b = razorpayPaymentSignature('order_x', 'pay_y', 'secret_b');
    expect(a).not.toBe(b);
  });

  it('produces different signatures when the payment id differs (tamper detection)', () => {
    const secret = 'rzp_test_secret_123';
    const legit = razorpayPaymentSignature('order_x', 'pay_y', secret);
    const tampered = razorpayPaymentSignature('order_x', 'pay_z', secret);
    expect(tampered).not.toBe(legit);
  });

  it('verifies webhook signatures over the raw body', () => {
    const webhookSecret = 'whsec_test_456';
    const rawBody = '{"event":"payment.captured"}';
    const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    expect(razorpayWebhookSignature(rawBody, webhookSecret)).toBe(expected);
  });

  it('sha256Hex is deterministic and 64 hex characters long', () => {
    const a = sha256Hex('some-fingerprint-input');
    const b = sha256Hex('some-fingerprint-input');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('billing/checkout status labels', () => {
  it('labels every known session status', () => {
    expect(checkoutStatusLabel('pending')).toBe('Awaiting payment');
    expect(checkoutStatusLabel('paid')).toBe('Paid');
    expect(checkoutStatusLabel('failed')).toBe('Failed');
    expect(checkoutStatusLabel('cancelled')).toBe('Cancelled');
    expect(checkoutStatusLabel('refunded')).toBe('Refunded');
    expect(checkoutStatusLabel('expired')).toBe('Expired');
  });

  it('passes through unknown statuses unchanged', () => {
    expect(checkoutStatusLabel('weird_state')).toBe('weird_state');
  });
});