import { describe, expect, it } from 'vitest';
import { cycleEnd } from '@/lib/billing/period';

describe('billing/period cycleEnd', () => {
  it('adds one month to a simple mid-month date (UTC)', () => {
    const start = new Date('2026-01-15T12:00:00Z');
    const end = cycleEnd(start, 'monthly');
    expect(end.toISOString()).toBe('2026-02-15T12:00:00.000Z');
  });

  it('clamps Jan 31 to the last day of February in a non-leap year', () => {
    const start = new Date('2026-01-31T00:00:00Z');
    expect(cycleEnd(start, 'monthly').toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  it('clamps Jan 31 to Feb 29 in a leap year', () => {
    const start = new Date('2028-01-31T00:00:00Z');
    expect(cycleEnd(start, 'monthly').toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });

  it('keeps March 31 clamped to the last day of April (30)', () => {
    const start = new Date('2026-03-31T00:00:00Z');
    expect(cycleEnd(start, 'monthly').toISOString()).toBe('2026-04-30T00:00:00.000Z');
  });

  it('preserves time-of-day across the cycle', () => {
    const start = new Date('2026-06-01T08:30:45.123Z');
    const end = cycleEnd(start, 'monthly');
    expect(end.toISOString()).toBe('2026-07-01T08:30:45.123Z');
    expect(end.getUTCHours()).toBe(8);
    expect(end.getUTCMinutes()).toBe(30);
    expect(end.getUTCSeconds()).toBe(45);
    expect(end.getUTCMilliseconds()).toBe(123);
  });

  it('adds a quarter (3 months)', () => {
    const start = new Date('2026-05-20T00:00:00Z');
    expect(cycleEnd(start, 'quarterly').toISOString()).toBe('2026-08-20T00:00:00.000Z');
  });

  it('adds a year across a year boundary', () => {
    const start = new Date('2025-12-15T10:00:00Z');
    expect(cycleEnd(start, 'yearly').toISOString()).toBe('2026-12-15T10:00:00.000Z');
  });

  it('adds a year from a leap day landing on the last day of February', () => {
    const start = new Date('2028-02-29T00:00:00Z');
    expect(cycleEnd(start, 'yearly').toISOString()).toBe('2029-02-28T00:00:00.000Z');
  });

  it('is a pure function (original date is never mutated)', () => {
    const start = new Date('2026-01-31T12:00:00Z');
    const snapshot = start.toISOString();
    cycleEnd(start, 'monthly');
    expect(start.toISOString()).toBe(snapshot);
  });
});