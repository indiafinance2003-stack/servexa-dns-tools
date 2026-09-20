import { describe, expect, it } from 'vitest';
import {
  generateTicketReference,
  normalizeTicketReference,
  isValidTicketReference,
} from '@/lib/support/reference';

describe('generateTicketReference', () => {
  it('uses the RT-YYYY-XXXXXXXX format', () => {
    const reference = generateTicketReference(new Date('2026-09-18T00:00:00Z'));
    expect(reference).toMatch(/^RT-2026-[0-9A-F]{8}$/);
  });

  it('uses the UTC year of the provided date', () => {
    const reference = generateTicketReference(new Date('2027-01-01T00:30:00Z'));
    expect(reference.startsWith('RT-2027-')).toBe(true);
  });

  it('generates distinct references on successive calls (CSPRNG)', () => {
    const seen = new Set<string>();
    for (let index = 0; index < 100; index += 1) {
      seen.add(generateTicketReference());
    }
    // 32 bits of entropy: a collision in 100 draws is astronomically unlikely,
    // and the database unique constraint remains the true safety net.
    expect(seen.size).toBe(100);
  });
});

describe('reference normalization and validation', () => {
  it('normalizes case and surrounding whitespace', () => {
    expect(normalizeTicketReference('  rt-2026-abcd1234 ')).toBe('RT-2026-ABCD1234');
  });

  it('accepts valid references', () => {
    expect(isValidTicketReference('RT-2026-DEADBEEF')).toBe(true);
    expect(isValidTicketReference('rt-2026-deadbeef')).toBe(true);
  });

  it('rejects malformed references', () => {
    expect(isValidTicketReference('RT-12345-DEADBEEF')).toBe(false);
    expect(isValidTicketReference('RT-2026-DEADBEE')).toBe(false);
    expect(isValidTicketReference('RT-2026-GHIJKLMN')).toBe(false);
    expect(isValidTicketReference('')).toBe(false);
    expect(isValidTicketReference('TICKET-1')).toBe(false);
  });
});
