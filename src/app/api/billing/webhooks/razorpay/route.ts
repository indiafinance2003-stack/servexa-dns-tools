import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { dbFromRequest } from '@/lib/db/request';
import { checkoutSessions, type CheckoutSessionRow } from '@/lib/db/schema';
import {
  BillingWebhookSignatureError,
  getBillingProvider,
  WebhookEvent,
} from '@/lib/billing/providers';
import {
  completePaidSession,
  markCheckoutSessionWebhookTerminal,
  recordSessionRefund,
} from '@/lib/billing/checkout';
import { logger } from '@/lib/logging/logger';

/**
 * Razorpay webhook endpoint.
 *
 * Signature verification runs on the RAW request body (never a JSON round-trip)
 * against the webhook secret. Only after that passes is the payload touched.
 * Processing is idempotent:
 *  - `payment.captured` / `order.paid` claim the session with a pending-only
 *    conditional UPDATE, so redelivery cannot double-activate or double-invoice.
 *  - `payment.failed` marks the session failed (pending-only).
 *  - `refund.processed` marks the session refunded and cancels the subscription.
 */

function getNestedString(payload: Record<string, unknown>, path: string[]): string | null {
  let current: unknown = payload;
  for (const key of path) {
    if (!current || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' && current.length > 0 ? current : null;
}

function extractOrderId(event: WebhookEvent): string | null {
  if (event.event === 'payment.captured' || event.event === 'payment.failed') {
    return getNestedString(event.payload, ['payment', 'entity', 'order_id']);
  }
  if (event.event === 'order.paid') {
    return getNestedString(event.payload, ['order', 'entity', 'id']);
  }
  return null;
}

function extractPaymentId(event: WebhookEvent): string | null {
  if (event.event === 'payment.captured' || event.event === 'payment.failed') {
    return getNestedString(event.payload, ['payment', 'entity', 'id']);
  }
  return null;
}

function extractRefundId(event: WebhookEvent): string | null {
  return getNestedString(event.payload, ['refund', 'entity', 'id']);
}

function extractRefundPaymentId(event: WebhookEvent): string | null {
  return getNestedString(event.payload, ['refund', 'entity', 'payment_id']);
}

function extractRefundOrderId(event: WebhookEvent): string | null {
  return getNestedString(event.payload, ['refund', 'entity', 'order_id']);
}

async function findSessionByOrderId(orderId: string): Promise<CheckoutSessionRow | null> {
  const { db } = dbFromRequest();
  const rows = await db
    .select()
    .from(checkoutSessions)
    .where(eq(checkoutSessions.providerSessionId, orderId))
    .limit(1);
  return rows[0] ?? null;
}

async function findSessionByPaymentId(paymentId: string): Promise<CheckoutSessionRow | null> {
  const { db } = dbFromRequest();
  const rows = await db
    .select()
    .from(checkoutSessions)
    .where(sql`${checkoutSessions.metadataJson}->>'paymentId' = ${paymentId}`)
    .limit(1);
  return rows[0] ?? null;
}

async function applyPaidWebhook(event: WebhookEvent, orderId: string): Promise<void> {
  const session = await findSessionByOrderId(orderId);
  if (!session) {
    // Unknown order: acknowledge but do nothing (Razorpay will stop retrying).
    logger.info('Webhook referenced an unknown order id.', { orderId, event: event.event });
    return;
  }
  await completePaidSession(session, {
    providerPaymentId: extractPaymentId(event),
    source: `webhook:${event.event}`,
  });
}

async function applyFailedWebhook(event: WebhookEvent, orderId: string): Promise<void> {
  const session = await findSessionByOrderId(orderId);
  if (!session) {
    logger.info('Webhook referenced an unknown order id.', { orderId, event: event.event });
    return;
  }
  await markCheckoutSessionWebhookTerminal(session, 'failed', {
    reason:
      getNestedString(event.payload, ['payment', 'entity', 'error_description']) ??
      'Payment failed',
    providerPaymentId: extractPaymentId(event),
  });
}

async function applyRefundWebhook(event: WebhookEvent): Promise<void> {
  const paymentId = extractRefundPaymentId(event);
  const orderId = extractRefundOrderId(event);

  let session: CheckoutSessionRow | null = orderId ? await findSessionByOrderId(orderId) : null;
  if (!session && paymentId) session = await findSessionByPaymentId(paymentId);

  if (!session) {
    logger.info('Refund webhook referenced an unknown payment or order.', {
      event: event.event,
      orderId,
      paymentId,
    });
    return;
  }

  await recordSessionRefund(session, {
    providerRefundId: extractRefundId(event),
    providerPaymentId: paymentId,
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const provider = getBillingProvider();
  if (!provider) {
    return NextResponse.json(
      { success: false, error: 'Payment integration not configured' },
      { status: 503 }
    );
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-razorpay-signature');

  let event: WebhookEvent;
  try {
    event = await provider.verifyWebhook(rawBody, signature);
  } catch (error) {
    if (error instanceof BillingWebhookSignatureError) {
      return NextResponse.json({ success: false }, { status: 400 });
    }
    return NextResponse.json({ success: false }, { status: 500 });
  }

  try {
    if (event.event === 'payment.captured' || event.event === 'order.paid' || event.event === 'payment.failed') {
      const orderId = extractOrderId(event);
      if (!orderId) {
        return NextResponse.json(
          { success: false, error: 'Order id missing from event' },
          { status: 400 }
        );
      }
      if (event.event === 'payment.failed') {
        await applyFailedWebhook(event, orderId);
      } else {
        await applyPaidWebhook(event, orderId);
      }
    } else if (event.event === 'refund.processed') {
      await applyRefundWebhook(event);
    }
    // Unknown events are acknowledged without side effects.
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logger.error(
      'Webhook processing failed',
      error instanceof Error ? error : new Error('Unknown webhook processing error')
    );
    return NextResponse.json({ success: false }, { status: 500 });
  }
}