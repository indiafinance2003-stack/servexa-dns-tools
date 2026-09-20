import { describe, expect, it } from 'vitest';
import { evaluateManagedSupportEntitlement } from '@/lib/support/entitlement';

const FUTURE = new Date('2030-01-01T00:00:00Z');
const PAST = new Date('2020-01-01T00:00:00Z');
const NOW = new Date('2026-01-01T00:00:00Z');

function entitlementFor(status: string, periodEnd: Date | null = FUTURE) {
  return evaluateManagedSupportEntitlement(
    { status, plan: 'managed_support', currentPeriodEnd: periodEnd },
    NOW
  );
}

describe('evaluateManagedSupportEntitlement', () => {
  it('returns none for accounts without a subscription record', () => {
    const entitlement = evaluateManagedSupportEntitlement(null, NOW);
    expect(entitlement.entitled).toBe(false);
    expect(entitlement.status).toBe('none');
    expect(entitlement.subscriptionStatus).toBe('none');
  });

  it('grants entitlement for an active subscription inside its period', () => {
    const entitlement = entitlementFor('active');
    expect(entitlement.entitled).toBe(true);
    expect(entitlement.status).toBe('entitled');
    expect(entitlement.planId).toBe('managed_support');
    expect(entitlement.maxOpenTickets).toBeGreaterThan(0);
  });

  it('expires an active subscription whose period has ended', () => {
    const entitlement = entitlementFor('active', PAST);
    expect(entitlement.entitled).toBe(false);
    expect(entitlement.status).toBe('expired');
  });

  it('grants trialing entitlement inside the trial period', () => {
    const entitlement = entitlementFor('trialing');
    expect(entitlement.entitled).toBe(true);
    expect(entitlement.status).toBe('trialing');
  });

  it('expires a finished trial', () => {
    const entitlement = entitlementFor('trialing', PAST);
    expect(entitlement.entitled).toBe(false);
    expect(entitlement.status).toBe('expired');
  });

  it('does not silently keep support open while a payment is outstanding', () => {
    const entitlement = entitlementFor('past_due');
    expect(entitlement.entitled).toBe(false);
    expect(entitlement.status).toBe('payment_issue');
  });

  it('denies canceled, expired and suspended subscriptions', () => {
    for (const status of ['canceled', 'expired', 'suspended']) {
      const entitlement = entitlementFor(status);
      expect(entitlement.entitled).toBe(false);
      expect(entitlement.status).toBe(status);
    }
  });

  it('treats unknown statuses as none (fail closed)', () => {
    const entitlement = entitlementFor('something_unexpected');
    expect(entitlement.entitled).toBe(false);
    expect(entitlement.status).toBe('none');
  });

  it('treats a missing period end as still valid for active records', () => {
    const entitlement = entitlementFor('active', null);
    expect(entitlement.entitled).toBe(true);
  });

  it('reports the billing integration honestly when no provider is configured', () => {
    const entitlement = evaluateManagedSupportEntitlement(null, NOW);
    expect(entitlement.billingIntegrationPending).toBe(true);
    expect(entitlement.billingConfigured).toBe(false);
  });
});
