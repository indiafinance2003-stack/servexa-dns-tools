import { describe, expect, it } from 'vitest';
import { formatMinorAmount, invoiceStatusLabel } from '@/lib/billing/invoices';
import { cycleEnd } from '@/lib/billing/period';
import { subscriptionLifecycle } from '@/lib/billing/subscriptions';
import { CHECKOUT_SESSION_STATUSES, INVOICE_STATUSES } from '@/lib/db/schema';

/**
 * Payment-flow unit tests. Everything here is pure and database-free: exact
 * minor-unit money formatting, cycle arithmetic across irregular months, and
 * the lifecycle/status guards that keep billed states honest.
 */

describe('formatMinorAmount', () => {
  it('renders the exact minor-unit amount without rounding it up', () => {
    expect(formatMinorAmount(1000, 'INR')).toBe('₹10.00');
    expect(formatMinorAmount(999, 'INR')).toBe('₹9.99');
    expect(formatMinorAmount(0, 'INR')).toBe('₹0.00');
  });

  it('keeps the real place value with the configured currency', () => {
    expect(formatMinorAmount(123456, 'INR')).toBe('₹1,234.56');
  });
});

describe('invoiceStatusLabel', () => {
  it('labels every status actually defined in the schema', () => {
    for (const status of INVOICE_STATUSES) {
      expect(invoiceStatusLabel(status).trim().length).toBeGreaterThan(0);
    }
  });

  it('passes through unknown statuses instead of guessing', () => {
    expect(invoiceStatusLabel('mystery')).toBe('mystery');
  });
});

describe('cycleEnd', () => {
  it('adds the right number of months per interval', () => {
    const start = new Date('2026-01-15T10:30:00Z');
    expect(cycleEnd(start, 'monthly').toISOString()).toBe('2026-02-15T10:30:00.000Z');
    expect(cycleEnd(start, 'quarterly').toISOString()).toBe('2026-04-15T10:30:00.000Z');
    expect(cycleEnd(start, 'yearly').toISOString()).toBe('2027-01-15T10:30:00.000Z');
  });

  it('clamps short target months instead of rolling into the next month', () => {
    const start = new Date('2026-01-31T00:00:00Z');
    expect(cycleEnd(start, 'monthly').toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(cycleEnd(start, 'yearly').toISOString()).toBe('2027-01-31T00:00:00.000Z');
  });

  it('handles leap years and year boundaries in UTC', () => {
    expect(cycleEnd(new Date('2024-01-31T00:00:00Z'), 'monthly').toISOString()).toBe(
      '2024-02-29T00:00:00.000Z'
    );
    expect(cycleEnd(new Date('2026-12-15T00:00:00Z'), 'monthly').toISOString()).toBe(
      '2027-01-15T00:00:00.000Z'
    );
  });
});

describe('subscriptionLifecycle', () => {
  it('documents a guarded stage list covering past_due as the only handled billing-failure state', () => {
    const lifecycle = subscriptionLifecycle();
    expect(lifecycle.stages.map((stage) => stage.stage)).toEqual([
      'Payment Due',
      'Payment Failed',
      'Retry',
      'Grace Period',
      'Suspended',
    ]);
    expect(lifecycle.stages.map((stage) => stage.subscriptionStatus)).toEqual([
      'active',
      'past_due',
      'past_due',
      'past_due',
      'suspended',
    ]);
  });

  it('keeps the grace period honest: announced only when a positive duration is configured', () => {
    const lifecycle = subscriptionLifecycle();
    expect(lifecycle.gracePeriodConfigured).toBe(lifecycle.gracePeriodDays > 0);
  });

  it('never claims a provider is configured when none is', () => {
    const lifecycle = subscriptionLifecycle();
    expect(lifecycle.providerConfigured).toBe(lifecycle.provider !== null && lifecycle.provider.length > 0);
  });
});

describe('checkout session statuses', () => {
  it('includes refunded and failed in the schema status set so refunds are representable', () => {
    expect(CHECKOUT_SESSION_STATUSES).toContain('refunded');
    expect(CHECKOUT_SESSION_STATUSES).toContain('failed');
    expect(CHECKOUT_SESSION_STATUSES).toContain('expired');
  });
});