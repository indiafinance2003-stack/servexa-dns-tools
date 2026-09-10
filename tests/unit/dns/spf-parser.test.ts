import { describe, it, expect } from 'vitest';
import { parseSPFRecord, isSpfRecord } from '@/lib/dns/analysis/spf-parser';

describe('SPF parser', () => {
  it('parses mechanisms and modifiers', () => {
    const parsed = parseSPFRecord('v=spf1 include:_spf.google.com ip4:192.0.2.0/24 ~all');
    expect(parsed.valid).toBe(true);
    expect(parsed.mechanisms.map((m) => m.type)).toEqual(['include', 'ip4', 'all']);
    expect(parsed.mechanisms[2].qualifier).toBe('~');
  });

  it('treats redirect as a modifier', () => {
    const parsed = parseSPFRecord('v=spf1 redirect=_spf.example.com');
    expect(parsed.modifiers[0]).toMatchObject({ name: 'redirect', value: '_spf.example.com' });
  });

  it('detects unknown mechanisms', () => {
    const parsed = parseSPFRecord('v=spf1 foo:bar -all');
    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]).toMatch(/Unknown mechanism/);
  });

  it('detects malformed version', () => {
    const parsed = parseSPFRecord('v=spf2 include:example.com');
    expect(parsed.valid).toBe(false);
  });

  it('identifies SPF TXT records', () => {
    expect(isSpfRecord('v=spf1 -all')).toBe(true);
    expect(isSpfRecord('hello')).toBe(false);
  });
});
