import { and, desc, eq, inArray } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import { config } from '@/lib/config';
import { dbFromRequest } from '@/lib/db/request';
import {
  checkoutSessions,
  invoices,
  subscriptions,
  CHECKOUT_SESSION_STATUSES,
  type CheckoutSessionRow,
  type CheckoutSessionStatus,
} from '@/lib/db/schema';
import { managedSupportPlan } from '@/lib/plans/catalog';
import { AppError, AppErrorCode } from '@/lib/errors/app-error';
import { cycleEnd } from './period';
import { nextInvoiceNumber } from './invoices';
import {
  BillingVerificationError,
  getBillingProvider,
  PaymentConfirmation,
} from './providers';
import { safeCreateNotification } from '@/lib/notifications/notifications';

/**
 * Checkout sessions for Managed Support.
 *
 * Invariants:
 *  - A session stores the exact quoted amount. Amounts are NEVER re-read from
 *    config after a session is created, so nothing between quoting and payment
 *    can change the price.
 *  - A session becomes 'paid' ONLY through a server-side signature check
 *    (`verifyAndCompletePayment`) or a signed webhook. There is no code path
 *    that fakes a successful payment.
 *  - Activation is idempotent: a duplicate webhook or a re-verify cannot
 *    double-activate or double-invoice.
 */

export interface CheckoutSessionDTO {
  id: string;
  plan: string;
  amountMinor: number;
  currency: string;
  billingInterval: string;
  status: string;
  statusLabel: string;
  /** Provider order id (when the provider order exists). */
  providerOrderId: string | null;
  /** Order id the checkout page needs to render an inline payment form. */
  providerOrderIdForClient: string | null;
  /** Public provider key id the browser needs for the checkout SDK. */
  providerKeyId: string | null;
  paidAt: string | null;
  createdAt: string;
  /** True when every payment credential is present and live. */
  paymentConfigured: boolean;
}

const CHECKOUT_STATUS_LABELS: Record<CheckoutSessionStatus, string> = {
  pending: 'Awaiting payment',
  paid: 'Paid',
  failed: 'Failed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  expired: 'Expired',
};

export function checkoutStatusLabel(status: string): string {
  return CHECKOUT_SESSION_STATUSES.includes(status as CheckoutSessionStatus)
    ? CHECKOUT_STATUS_LABELS[status as CheckoutSessionStatus]
    : status;
}

function toDTO(
  row: CheckoutSessionRow,
  options: { exposeClientKeys: boolean }
): CheckoutSessionDTO {
  const withdrawProvider = !options.exposeClientKeys;
  return {
    id: row.id,
    plan: row.plan,
    amountMinor: row.amountMinor,
    currency: row.currency,
    billingInterval: row.billingInterval,
    status: row.status,
    statusLabel: checkoutStatusLabel(row.status),
    providerOrderId: row.providerSessionId,
    providerOrderIdForClient: withdrawProvider ? null : row.providerSessionId,
    providerKeyId: withdrawProvider
      ? null
      : getBillingProvider()
        ? config.RAZORPAY_KEY_ID
        : null,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    paymentConfigured: getBillingProvider() !== null,
  };
}

function makeReceipt(): string {
  const rand = randomBytes(4).toString('hex').toUpperCase();
  return `${config.INVOICE_NUMBER_PREFIX}-CO-${rand}`;
}

async function getOwnedSession(userId: string, sessionId: string): Promise<CheckoutSessionRow> {
  const { db } = dbFromRequest();
  const rows = await db
    .select()
    .from(checkoutSessions)
    .where(and(eq(checkoutSessions.id, sessionId), eq(checkoutSessions.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new AppError(AppErrorCode.NOT_FOUND, 'Checkout session not found.', 404);
  }
  return row;
}

/**
 * Starts (or resumes) checkout for Managed Support. Idempotent: a pending
 * session for the same user is resumed instead of creating a second one, and a
 * provider order is only created once per session.
 */
export async function startManagedSupportCheckout(userId: string): Promise<CheckoutSessionDTO> {
  const provider = getBillingProvider();
  if (!provider) {
    throw new AppError(
      AppErrorCode.SERVICE_UNAVAILABLE,
      'Checkout is not available yet — the payment integration is not configured.',
      503
    );
  }

  const plan = managedSupportPlan();
  const price = plan.price;
  if (!price || price.amountMinor <= 0 || price.amountMinor > 100_000_000) {
    throw new AppError(
      AppErrorCode.SERVICE_UNAVAILABLE,
      'The Managed Support price is not finalised yet.',
      503
    );
  }

  const { db } = dbFromRequest();

  // A customer already entitled to Managed Support must not be charged again.
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  if (existing[0] && (existing[0].status === 'active' || existing[0].status === 'trialing')) {
    throw new AppError(
      AppErrorCode.VALIDATION_ERROR,
      'Managed Support is already active on this account.',
      400
    );
  }

  const now = new Date();

  // Resume an outstanding pending session rather than stacking duplicates.
  const pending = await db
    .select()
    .from(checkoutSessions)
    .where(
      and(
        eq(checkoutSessions.userId, userId),
        eq(checkoutSessions.status, 'pending')
      )
    )
    .orderBy(desc(checkoutSessions.createdAt))
    .limit(1);

  let row = pending[0] ?? null;
  if (!row) {
    const receipt = makeReceipt();
    const [inserted] = await db
      .insert(checkoutSessions)
      .values({
        userId,
        plan: plan.id,
        currency: price.currency,
        amountMinor: price.amountMinor,
        billingInterval: price.interval,
        status: 'pending',
        providerReceiptId: receipt,
      })
      .returning();
    row = inserted;
  }

  if (!row.providerSessionId) {
    const created = await provider.createOrder({
      receipt: row.providerReceiptId ?? makeReceipt(),
      amountMinor: row.amountMinor,
      currency: row.currency,
      note: `Managed Support checkout (${plan.name})`,
    });
    const [updated] = await db
      .update(checkoutSessions)
      .set({ providerSessionId: created.providerOrderId, updatedAt: now })
      .where(eq(checkoutSessions.id, row.id))
      .returning();
    row = updated;
  }

  return toDTO(row, { exposeClientKeys: row.status === 'pending' });
}

/** Reads one owned session (no side effects). */
export async function getCheckoutSession(
  userId: string,
  sessionId: string
): Promise<CheckoutSessionDTO> {
  const row = await getOwnedSession(userId, sessionId);
  return toDTO(row, { exposeClientKeys: row.status === 'pending' });
}

/**
 * Verifies a payment the customer just completed. The signature check uses the
 * provider secret server-side; on success the session is marked paid and the
 * subscription is activated atomically.
 */
export async function verifyAndCompletePayment(
  userId: string,
  sessionId: string,
  confirmation: PaymentConfirmation
): Promise<CheckoutSessionDTO> {
  const row = await getOwnedSession(userId, sessionId);

  if (row.status !== 'pending') {
    throw new AppError(
      AppErrorCode.VALIDATION_ERROR,
      'There is no pending payment for this checkout session.',
      400
    );
  }
  if (!row.providerSessionId) {
    throw new AppError(AppErrorCode.VALIDATION_ERROR, 'This checkout has no provider order yet.', 400);
  }

  const provider = getBillingProvider();
  if (!provider) {
    throw new AppError(
      AppErrorCode.SERVICE_UNAVAILABLE,
      'The payment integration is not configured.',
      503
    );
  }

  await provider.verifyPayment(confirmation);

  if (confirmation.providerOrderId !== row.providerSessionId) {
    throw new BillingVerificationError(
      'The payment confirmation references a different order than this checkout.'
    );
  }

  await completePaidSession(row, {
    providerPaymentId: confirmation.providerPaymentId,
    source: 'payment_verified',
  });

  return getCheckoutSession(userId, sessionId);
}

export interface PaidSessionInfo {
  providerPaymentId: string | null;
  source: string;
}

/**
 * Idempotent activation: marks the session paid and (in one transaction)
 * activates the subscription and records the paid invoice. The session is
 * claimed with a conditional UPDATE (pending-only), so concurrent redeliveries
 * of the same webhook can never double-activate or double-invoice.
 */
export async function completePaidSession(
  session: CheckoutSessionRow,
  info: PaidSessionInfo
): Promise<{ activated: boolean }> {
  if (session.status === 'paid') return { activated: false };

  const { db } = dbFromRequest();
  const now = new Date();
  const interval = (['monthly', 'quarterly', 'yearly'] as const).includes(
    session.billingInterval as 'monthly' | 'quarterly' | 'yearly'
  )
    ? (session.billingInterval as 'monthly' | 'quarterly' | 'yearly')
    : 'monthly';

  const start = now;
  const end = cycleEnd(now, interval);
  const invoiceNumber = await nextInvoiceNumber(now);

  const activated = await db.transaction(async (tx) => {
    const claimed = await tx
      .update(checkoutSessions)
      .set({
        status: 'paid',
        paidAt: now,
        failureReason: null,
        metadataJson: {
          ...(session.metadataJson as Record<string, unknown> | null),
          paymentId: info.providerPaymentId,
          source: info.source,
        },
        updatedAt: now,
      })
      .where(and(eq(checkoutSessions.id, session.id), eq(checkoutSessions.status, 'pending')))
      .returning({ id: checkoutSessions.id });
    if (claimed.length === 0) {
      // A concurrent activation (or a terminal transition) won the race. Never
      // re-activate or double-invoice.
      return false;
    }

    const existing = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, session.userId))
      .limit(1);

    if (existing[0]) {
      await tx
        .update(subscriptions)
        .set({
          status: 'active',
          plan: session.plan,
          pricePerCycle: session.amountMinor,
          currency: session.currency,
          billingInterval: interval,
          currentPeriodStart: start,
          currentPeriodEnd: end,
          providerSubscriptionId:
            existing[0].providerSubscriptionId ?? session.providerSessionId,
          canceledAt: null,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existing[0].id));
    } else {
      await tx.insert(subscriptions).values({
        userId: session.userId,
        status: 'active',
        plan: session.plan,
        pricePerCycle: session.amountMinor,
        currency: session.currency,
        billingInterval: interval,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        providerSubscriptionId: session.providerSessionId,
      });
    }

    await tx.insert(invoices).values({
      userId: session.userId,
      invoiceNumber,
      status: 'paid',
      amount: session.amountMinor,
      currency: session.currency,
      description: `Managed Support (${interval})`,
      providerInvoiceId: info.providerPaymentId,
      periodStart: start,
      periodEnd: end,
      issuedAt: now,
      paidAt: now,
    });

    return true;
  });

  if (activated) {
    await safeCreateNotification({
      userId: session.userId,
      type: 'subscription_created',
      title: 'Managed Support activated',
      body: 'Your Managed Support subscription is now active.',
      link: '/account/support',
    });
    await safeCreateNotification({
      userId: session.userId,
      type: 'invoice_paid',
      title: `Invoice ${invoiceNumber} paid`,
      body: `Payment received for Managed Support (${interval}).`,
      link: '/account/billing',
    });
  }

  return { activated };
}

/**
 * Marks a cancelled/failed/expired session. Used when the customer abandons
 * checkout or the provider reports a failed/expired order. Only pending
 * sessions can transition here: a paid session is never reclassified as failed
 * or cancelled by a non-paying event.
 */
export async function markCheckoutSessionFailed(
  userId: string,
  sessionId: string,
  status: Extract<CheckoutSessionStatus, 'cancelled' | 'failed' | 'expired'>,
  reason?: string
): Promise<void> {
  const { db } = dbFromRequest();
  await db
    .update(checkoutSessions)
    .set({ status, failureReason: reason ?? null, updatedAt: new Date() })
    .where(
      and(
        eq(checkoutSessions.id, sessionId),
        eq(checkoutSessions.userId, userId),
        eq(checkoutSessions.status, 'pending')
      )
    );
}

/**
 * Webhook-driven terminal transition for a non-paying event (failed/expired).
 * The same pending-only guard applies, so a redelivered `payment.failed` can
 * never overwrite a session that already went paid.
 */
export async function markCheckoutSessionWebhookTerminal(
  session: CheckoutSessionRow,
  status: Extract<CheckoutSessionStatus, 'cancelled' | 'failed' | 'expired'>,
  info: { reason?: string; providerPaymentId?: string | null } = {}
): Promise<void> {
  const { db } = dbFromRequest();
  await db
    .update(checkoutSessions)
    .set({
      status,
      failureReason: info.reason ?? null,
      metadataJson: {
        ...(session.metadataJson as Record<string, unknown> | null),
        ...(info.providerPaymentId ? { paymentId: info.providerPaymentId } : {}),
      },
      updatedAt: new Date(),
    })
    .where(and(eq(checkoutSessions.id, session.id), eq(checkoutSessions.status, 'pending')));
}

export interface SessionRefundInfo {
  providerRefundId: string | null;
  providerPaymentId?: string | null;
  refundedAt?: Date;
}

/**
 * Records a processed refund. The session is marked 'refunded' (only from
 * pending/paid) and the affected subscription is switched to 'canceled', which
 * is the source of truth the entitlement layer reads — a refunded customer must
 * not keep Managed Support open. Redeliveries are no-ops.
 */
export async function recordSessionRefund(
  session: CheckoutSessionRow,
  info: SessionRefundInfo
): Promise<void> {
  const { db } = dbFromRequest();
  const now = new Date();
  const updated = await db
    .update(checkoutSessions)
    .set({
      status: 'refunded',
      failureReason: null,
      paidAt: session.paidAt ?? now,
      metadataJson: {
        ...(session.metadataJson as Record<string, unknown> | null),
        refundId: info.providerRefundId,
        refundedAt: (info.refundedAt ?? now).toISOString(),
        ...(info.providerPaymentId ? { paymentId: info.providerPaymentId } : {}),
      },
      updatedAt: now,
    })
    .where(
      and(
        eq(checkoutSessions.id, session.id),
        inArray(checkoutSessions.status, ['pending', 'paid'])
      )
    )
    .returning({ id: checkoutSessions.id });

  if (updated.length === 0) return;

  await db
    .update(subscriptions)
    .set({
      status: 'canceled',
      canceledAt: now,
      cancellationReason: 'Refunded',
      updatedAt: now,
    })
    .where(and(eq(subscriptions.userId, session.userId), eq(subscriptions.plan, session.plan)));

  await safeCreateNotification({
    userId: session.userId,
    type: 'subscription_status_changed',
    title: 'Managed Support canceled',
    body: 'Your payment was refunded, so Managed Support was disabled on this account.',
    link: '/account/billing',
  });
}