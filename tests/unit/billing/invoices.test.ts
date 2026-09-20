import { describe, expect, it } from 'vitest';
import { formatMinorAmount, invoiceStatusLabel } from '@/lib/billing/invoices';

describe('invoice status labels', () => {
  it('maps known statuses to customer-safe labels', () => {
    expect(invoiceStatusLabel('pending')).toBe('Awaiting payment');
    expect(invoiceStatusLabel('paid')).toBe('Paid');
    expect(invoiceStatusLabel('void')).toBe('Void');
    expect(invoiceStatusLabel('uncollectible')).toBe('Uncollectible');
  });

  it('passes unknown statuses through instead of inventing a label', () => {
    expect(invoiceStatusLabel('mystery')).toBe('mystery');
  });
});

describe('formatMinorAmount', () => {
  it('formats integer minor units (never floats) for display', () => {
    expect(formatMinorAmount(59900, 'INR')).toContain('599');
    expect(formatMinorAmount(1, 'INR')).toContain('0.01');
  });

  it('does not lose precision on large amounts', () => {
    expect(formatMinorAmount(123456789, 'INR')).toContain('12,34,567.89');
  });
});
