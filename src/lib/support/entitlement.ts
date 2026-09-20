import { and, eq } from 'drizzle-orm';
import { config } from '@/lib/config';
import { dbFromRequest } from '@/lib/db/request';
import { subscriptions, type SubscriptionStatus } from '@/lib/db/schema';
import {
  MANAGED_SUPPORT_PLAN_ID,
  isBillingProviderConfigured,
  managedSupportPlan,
} from '@/lib/plans/catalog';
import { SupportEntitlementRequiredError } from './errors';

/**
 * Managed Support entitlement.
 *
 * A normal registered account does NOT receive Managed Support. Entitlement is
 * derived exclusively from a subscription record in the database — never from a
 * client-provided flag, query parameter or cookie.
 *
 * No payment gateway is wired up yet, so no subscription can currently be
 * created by a customer through the website. That is reported honestly
 * (`billingIntegrationPending: true`) rather than faked: the entitlement
 * architecture exists and is enforced, and it activates the moment real
 * subscription records exist.
 */

export type EntitlementStatus =
  | 'entitled'
  | 'trialing'
  | 'payment_issue'
  | 'canceled'
  | 'expired'
  | 'suspended'
  | 'none'
  | 'unavailable';

export interface SubscriptionRecordLike {
  status: string;
  plan: string;
  currentPeriodEnd: Date | null;
}

export interface ManagedSupportEntitlement {
  entitled: boolean;
  status: EntitlementStatus;
  planId: string | null;
  /** Raw subscription status ('none' when the account has no record). */
  subscriptionStatus: SubscriptionStatus | 'none';
  currentPeriodEnd: string | null;
  /** False while no billing provider is configured (see module docs). */
  billingConfigured: boolean;
  /** True when purchasing is impossible purely because no gateway exists yet. */
  billingIntegrationPending: boolean;
  /** Open ticket limit that applies to entitled customers. */
  maxOpenTickets: number | null;
  /** Short, customer-safe explanation of the current state. */
  reason: string;
}

function baseEntitlement(): ManagedSupportEntitlement {
  const plan = managedSupportPlan();
  return {
    entitled: false,
    status: 'none',
    planId: plan.id,
    subscriptionStatus: 'none',
    currentPeriodEnd: null,
    billingConfigured: isBillingProviderConfigured(),
    billingIntegrationPending: !isBillingProviderConfigured(),
    maxOpenTickets: plan.limits.maxOpenTickets,
    reason: 'No Managed Support subscription is recorded on this account.',
  };
}

/**
 * Pure entitlement evaluation. Kept free of database access so every
 * transition below can be unit tested exhaustively.
 */
export function evaluateManagedSupportEntitlement(
  subscription: SubscriptionRecordLike | null,
  now: Date = new Date()
): ManagedSupportEntitlement {
  const entitlement = baseEntitlement();
  if (!subscription) return entitlement;

  entitlement.subscriptionStatus = subscription.status as SubscriptionStatus;
  entitlement.planId = subscription.plan || MANAGED_SUPPORT_PLAN_ID;
  entitlement.currentPeriodEnd = subscription.currentPeriodEnd
    ? subscription.currentPeriodEnd.toISOString()
    : null;

  const periodEnded =
    subscription.currentPeriodEnd !== null &&
    subscription.currentPeriodEnd.getTime() <= now.getTime();

  switch (subscription.status) {
    case 'active': {
      if (periodEnded) {
        entitlement.status = 'expired';
        entitlement.reason =
          'The Managed Support billing period has ended. Renewal is required to reopen the support queue.';
        return entitlement;
      }
      entitlement.entitled = true;
      entitlement.status = 'entitled';
      entitlement.reason = 'Managed Support is active on this account.';
      return entitlement;
    }
    case 'trialing': {
      if (periodEnded) {
        entitlement.status = 'expired';
        entitlement.reason = 'The Managed Support trial period has ended.';
        return entitlement;
      }
      entitlement.entitled = true;
      entitlement.status = 'trialing';
      entitlement.reason = 'Managed Support is in a trial period on this account.';
      return entitlement;
    }
    case 'past_due': {
      // The exact grace-period duration is an open commercial decision
      // (config.BILLING_GRACE_PERIOD_DAYS defaults to 0 = not decided), so a
      // past-due subscription does not silently keep support open.
      entitlement.status = 'payment_issue';
      entitlement.reason =
        'A payment for Managed Support is outstanding. Support reopens once the balance is settled.';
      return entitlement;
    }
    case 'canceled': {
      entitlement.status = 'canceled';
      entitlement.reason = 'This Managed Support subscription was canceled.';
      return entitlement;
    }
    case 'expired': {
      entitlement.status = 'expired';
      entitlement.reason = 'This Managed Support subscription has expired.';
      return entitlement;
    }
    case 'suspended': {
      entitlement.status = 'suspended';
      entitlement.reason = 'This Managed Support subscription is suspended.';
      return entitlement;
    }
    default: {
      entitlement.status = 'none';
      entitlement.reason = 'No active Managed Support subscription is recorded on this account.';
      return entitlement;
    }
  }
}

/**
 * Reads the entitlement for a specific user id. The id must come from the
 * authenticated session — never from a request body, query string or cookie.
 *
 * If the database is unreachable the caller is treated as NOT entitled (fail
 * closed) and `status` is 'unavailable' so the UI can explain the situation
 * instead of silently denying access.
 */
export async function getManagedSupportEntitlement(
  userId: string
): Promise<ManagedSupportEntitlement> {
  try {
    const { db } = dbFromRequest();
    const rows = await db
      .select({
        status: subscriptions.status,
        plan: subscriptions.plan,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions)
      .where(
        and(eq(subscriptions.userId, userId), eq(subscriptions.plan, MANAGED_SUPPORT_PLAN_ID))
      )
      .limit(1);

    return evaluateManagedSupportEntitlement(rows[0] ?? null);
  } catch {
    const entitlement = baseEntitlement();
    entitlement.status = 'unavailable';
    entitlement.reason = 'Managed Support status could not be verified right now. Please try again.';
    return entitlement;
  }
}

/** Same as above, but throws the support-domain error when not entitled. */
export async function requireManagedSupportEntitlement(
  userId: string
): Promise<ManagedSupportEntitlement> {
  const entitlement = await getManagedSupportEntitlement(userId);
  if (!entitlement.entitled) {
    throw new SupportEntitlementRequiredError(
      `${entitlement.reason} See /services for the Managed Support scope.`
    );
  }
  return entitlement;
}

/** Customer-safe summary used by the portal and public pages. */
export interface ManagedSupportSummary {
  entitled: boolean;
  status: EntitlementStatus;
  label: string;
  reason: string;
  billingConfigured: boolean;
  billingIntegrationPending: boolean;
  priceConfigured: boolean;
}

const ENTITLEMENT_LABELS: Record<EntitlementStatus, string> = {
  entitled: 'Active',
  trialing: 'Trialing',
  payment_issue: 'Payment outstanding',
  canceled: 'Canceled',
  expired: 'Expired',
  suspended: 'Suspended',
  none: 'Not subscribed',
  unavailable: 'Unavailable',
};

export function entitlementLabel(status: EntitlementStatus): string {
  return ENTITLEMENT_LABELS[status];
}

export function toManagedSupportSummary(
  entitlement: ManagedSupportEntitlement
): ManagedSupportSummary {
  return {
    entitled: entitlement.entitled,
    status: entitlement.status,
    label: entitlementLabel(entitlement.status),
    reason: entitlement.reason,
    billingConfigured: entitlement.billingConfigured,
    billingIntegrationPending: entitlement.billingIntegrationPending,
    priceConfigured: config.MANAGED_SUPPORT_PRICE_MINOR > 0,
  };
}