import { describe, expect, it } from 'vitest';
import { parseToolSearchParams } from '@/lib/client/tool-params';
import { DNSRecordType } from '@/types/domain';

/**
 * Regression tests for the DNS Lookup "domain disappears" bug: the homepage
 * search navigates to /dns/lookup?domain=... and the page must prefill the
 * tool from the URL instead of showing an empty form.
 */
describe('parseToolSearchParams', () => {
  it('prefills the domain from ?domain=', () => {
    const params = parseToolSearchParams({ domain: 'google.com' });
    expect(params.domain).toBe('google.com');
  });

  it('strips protocol and paths users paste', () => {
    const params = parseToolSearchParams({ domain: 'https://example.com/mail' });
    expect(params.domain).toBe('example.com');
  });

  it('strips trailing dots', () => {
    const params = parseToolSearchParams({ domain: 'example.com.' });
    expect(params.domain).toBe('example.com');
  });

  it('accepts a valid record type and uppercases it', () => {
    const params = parseToolSearchParams({ domain: 'google.com', recordType: 'mx' });
    expect(params.recordType).toBe(DNSRecordType.MX);
  });

  it('ignores invalid record types instead of passing them through', () => {
    const params = parseToolSearchParams({ domain: 'example.com', recordType: 'DROP TABLE' });
    expect(params.recordType).toBeUndefined();
  });

  it('supports ?type= as an alias for ?recordType=', () => {
    const params = parseToolSearchParams({ type: 'txt' });
    expect(params.recordType).toBe(DNSRecordType.TXT);
  });

  it('parses selector and ip parameters', () => {
    const params = parseToolSearchParams({ selector: 'google', ip: '8.8.8.8' });
    expect(params.selector).toBe('google');
    expect(params.ip).toBe('8.8.8.8');
  });

  it('rejects malformed selectors', () => {
    expect(parseToolSearchParams({ selector: 'bad selector!' }).selector).toBeUndefined();
  });

  it('ignores empty and whitespace-only values', () => {
    const params = parseToolSearchParams({ domain: '   ', recordType: '', selector: ' ' });
    expect(params).toEqual({});
  });

  it('uses the first value when an array is provided', () => {
    const params = parseToolSearchParams({ domain: ['google.com', 'example.com'] });
    expect(params.domain).toBe('google.com');
  });

  it('ignores non-string values entirely', () => {
    const params = parseToolSearchParams({ domain: undefined, recordType: undefined });
    expect(params).toEqual({});
  });
});
