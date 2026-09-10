import { describe, it, expect } from 'vitest';
import { parseDKIMDnsRecord, parseDKIMSignatureHeader } from '@/lib/dns/analysis/dkim-parser';

describe('DKIM parsing', () => {
  it('parses a DNS key record', () => {
    const parsed = parseDKIMDnsRecord('v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ');
    expect(parsed.publicKeyPresent).toBe(true);
    expect(parsed.keyType).toBe('rsa');
    expect(parsed.valid).toBe(true);
  });

  it('treats empty p= as revoked', () => {
    const parsed = parseDKIMDnsRecord('v=DKIM1; p=');
    expect(parsed.publicKeyPresent).toBe(false);
    expect(parsed.valid).toBe(false);
  });

  it('parses signature header tags including b, t, x, i, l, q, z', () => {
    const parsed = parseDKIMSignatureHeader(
      'v=1; a=rsa-sha256; d=example.com; s=s1; c=relaxed/relaxed; h=from:to; bh=abc; b=sig; t=1; x=2; i=@example.com; l=100; q=dns/txt; z=From:x'
    );
    expect(parsed.signingDomain).toBe('example.com');
    expect(parsed.selector).toBe('s1');
    expect(parsed.signature).toBe('sig');
    expect(parsed.timestamp).toBe('1');
    expect(parsed.expiration).toBe('2');
    expect(parsed.identity).toBe('@example.com');
    expect(parsed.bodyLength).toBe('100');
    expect(parsed.query).toBe('dns/txt');
    expect(parsed.copiedHeaderFields).toBe('From:x');
    expect(parsed.cryptographicVerification).toBe('not_performed');
  });
});
