import { desc, eq } from 'drizzle-orm';
import { config } from '@/lib/config';
import { dbFromRequest } from '@/lib/db/request';
import {
  subscriptions,
  SUBSCRIPTION_STATUSES,
  type SubscriptionRow,
  type SubscriptionStatus,
} from '@/lib/db/schema';
import { findPlan, managedSupportPlan } from '@/lib/plans/catalog';
import { isPaymentConfigured } from './providers';

/**
 * Subscription read foundation.
 *
 * ONLY real records from the `subscriptions` table are ever returned. There is
 * no placeholder, demo or simulated subscription: an account with no row simply
 * has no subscription (`current: null`), which the UI renders as "not
 * subscribed" rather than inventing a plan.
 *
 * No payment provider is configured yet (`config.BILLING_PROVIDER` empty), so
 * there is deliberately no customer-facing "subscribe" write path here. The
 * lifecycle vocabulary below documents the intended status machine so the
 * eventual provider integration plugs into an existing contract.
 */

export interface SubscriptionDTO {
  id: string;
  planId: string;
  planName: string;
  status: string;
  statusLabel: string;
  billingInterval: string;
  /** Recorded cycle price in minor units, or null when not recorded. */
  priceMinor: number | null;
  currency: string;
  /** True only when a provider subscription reference exists on the record. */
  providerLinked: boolean;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatus, string> = {
  none: 'Not subscribed',
  active: 'Active',
  trialing: 'Trialing',
  past_due: 'Payment outstanding',
  canceled: 'Canceled',
  expired: 'Expired',
  suspended: 'Suspended',
};

export function subscriptionStatusLabel(status: string): string {
  return SUBSCRIPTION_STATUSES.includes(status as SubscriptionStatus)
    ? SUBSCRIPTION_STATUS_LABELS[status as SubscriptionStatus]
    : status;
}

/**
 * Documented lifecycle vocabulary.
 *
 * Payment Due → Payment Failed → Retry → Grace Period → Suspended
 *
 * The exact grace-period duration and retry policy are open commercial
 * decisions, so they are configuration (`config.BILLING_GRACE_PERIOD_DAYS`,
 * default 0 = not decided) instead of hard-coded numbers.
 */
export function subscriptionLifecycle(): {
  stages: Array<{ stage: string; subscriptionStatus: SubscriptionStatus; handled: boolean }>;
  gracePeriodDays: number;
  gracePeriodConfigured: boolean;
  providerConfigured: boolean;
  provider: string | null;
} {
  return {
    stages: [
      { stage: 'Payment Due', subscriptionStatus: 'active', handled: false },
      { stage: 'Payment Failed', subscriptionStatus: 'past_due', handled: true },
      { stage: 'Retry', subscriptionStatus: 'past_due', handled: false },
      { stage: 'Grace Period', subscriptionStatus: 'past_due', handled: false },
      { stage: 'Suspended', subscriptionStatus: 'suspended', handled: true },
    ],
    gracePeriodDays: config.BILLING_GRACE_PERIOD_DAYS,
    gracePeriodConfigured: config.BILLING_GRACE_PERIOD_DAYS > 0,
    providerConfigured: config.BILLING_PROVIDER.length > 0,
    provider: config.BILLING_PROVIDER || null,
  };
}

function toDTO(row: SubscriptionRow): SubscriptionDTO {
  const plan = findPlan(row.plan);
  return {
    id: row.id,
    planId: row.plan,
    planName: plan?.name ?? row.plan,
    status: row.status,
    statusLabel: subscriptionStatusLabel(row.status),
    billingInterval: row.billingInterval,
    priceMinor: row.pricePerCycle,
    currency: row.currency,
    providerLinked:
      typeof row.providerSubscriptionId === 'string' && row.providerSubscriptionId.length > 0,
    currentPeriodStart: row.currentPeriodStart ? row.currentPeriodStart.toISOString() : null,
    currentPeriodEnd: row.currentPeriodEnd ? row.currentPeriodEnd.toISOString() : null,
    canceledAt: row.canceledAt ? row.canceledAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** All subscriptions for one customer. The user id must come from the session. */
export async function listSubscriptions(userId: string): Promise<SubscriptionDTO[]> {
  const { db } = dbFromRequest();
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt));
  return rows.map(toDTO);
}

/**
 * The customer's current (most recent) subscription, or null when none exists.
 * Null is a real, honest answer — never replaced with a default plan.
 */
export async function getCurrentSubscription(userId: string): Promise<SubscriptionDTO | null> {
  const rows = await listSubscriptions(userId);
  return rows[0] ?? null;
}

/**
 * Whether the customer can start a Managed Support subscription through the
 * website right now. False while no billing provider is configured, so the UI
 * must present the honest "billing integration pending" state instead of a
 * checkout that cannot complete.
 */
export function canPurchaseManagedSupport(): boolean {
  return isPaymentConfigured() && managedSupportPlan().price !== null;
}

/** Display metadata for the billing page (plan price, currency, interval). */
export function billingDisplayInfo(): {
  planId: string;
  planName: string;
  amountMinor: number;
  currency: string;
  interval: string;
  providerConfigured: boolean;
} {
  const plan = managedSupportPlan();
  return {
    planId: plan.id,
    planName: plan.name,
    amountMinor: plan.price?.amountMinor ?? 0,
    currency: plan.price?.currency ?? config.MANAGED_SUPPORT_CURRENCY,
    interval: plan.price?.interval ?? 'monthly',
    providerConfigured: isPaymentConfigured(),
  };
}