import { describe, it, expect, vi } from 'vitest';
import { analyzeDNS } from '@/lib/dns/analysis/dns-analyzer';
import { analyzeNameservers } from '@/lib/dns/analysis/nameserver-analyzer';
import { inspectDnssec } from '@/lib/dns/analysis/dnssec-inspector';
import { compareResolvers } from '@/lib/dns/analysis/resolver-comparison';
import * as resolver from '@/lib/dns/resolver/dns-resolver';
import { DNSRecordType } from '@/types/domain';

function lookup(type: DNSRecordType, records: unknown[], status: 'success' | 'empty' = 'success') {
  return {
    domain: 'example.com',
    recordType: type,
    records,
    status,
    queryTime: 1,
  };
}

describe('DNS analysis findings', () => {
  it('emits findings from mocked records without inventing extra evidence', async () => {
    vi.spyOn(resolver, 'resolveDNS').mockImplementation(async (_name, type) => {
      if (type === DNSRecordType.A) return lookup(type, [{ address: '192.0.2.1', ttl: 60 }]);
      if (type === DNSRecordType.AAAA) return lookup(type, [], 'empty');
      if (type === DNSRecordType.MX) return lookup(type, [{ priority: 10, exchange: 'mail.example.com' }, { priority: 20, exchange: 'mail2.example.com' }]);
      if (type === DNSRecordType.NS) return lookup(type, ['ns1.example.com', 'ns2.example.com']);
      if (type === DNSRecordType.TXT) return lookup(type, [['v=spf1 -all']]);
      if (type === DNSRecordType.SOA) return lookup(type, [{ nsname: 'ns1.example.com', hostmaster: 'hostmaster.example.com', serial: 1, refresh: 3600, retry: 600, expire: 86400, minimum: 300 }]);
      if (type === DNSRecordType.CAA) return lookup(type, [], 'empty');
      if (type === DNSRecordType.CNAME) return lookup(type, [], 'empty');
      return lookup(type, [], 'empty');
    });
    vi.spyOn(resolver, 'resolveSpecial').mockResolvedValue({ records: [], status: 'empty', queryTime: 1 });

    const result = await analyzeDNS('example.com');
    expect(result.findings.some((f) => f.code === 'A_PRESENT')).toBe(true);
    expect(result.findings.some((f) => f.code === 'AAAA_MISSING')).toBe(true);
    expect(result.findings.some((f) => f.code === 'MX_MULTIPLE')).toBe(true);
    expect(result.findings.some((f) => f.code === 'CAA_MISSING')).toBe(true);
    expect(result.dnssec.cryptographicValidationPerformed).toBe(false);
  });
});

describe('Nameserver analysis', () => {
  it('warns when a nameserver hostname does not resolve', async () => {
    vi.spyOn(resolver, 'resolveDNS').mockImplementation(async (name, type) => {
      if (type === DNSRecordType.NS) return lookup(type, ['ns1.example.com']);
      return { domain: name, recordType: type, records: [], status: 'empty', queryTime: 1 };
    });
    const result = await analyzeNameservers('example.com');
    expect(result.findings.some((f) => f.code === 'NS_UNRESOLVED' || f.code === 'NS_SINGLE')).toBe(true);
  });
});

describe('DNSSEC inspection', () => {
  it('reports absent when no records are returned', async () => {
    vi.spyOn(resolver, 'resolveSpecial').mockResolvedValue({ records: [], status: 'empty', queryTime: 1 });
    const result = await inspectDnssec('example.com');
    expect(result.determination).toBe('appears_absent');
  });

  it('reports enabled when DS is present without claiming crypto validation', async () => {
    vi.spyOn(resolver, 'resolveSpecial').mockImplementation(async (_n, rrtype) => {
      if (rrtype === 'DS') return { records: [{ keyTag: 1 }], status: 'success', queryTime: 1 };
      return { records: [], status: 'empty', queryTime: 1 };
    });
    const result = await inspectDnssec('example.com');
    expect(result.determination).toBe('appears_enabled');
    expect(result.cryptographicValidationPerformed).toBe(false);
  });
});

describe('Resolver comparison', () => {
  it('records unavailable resolvers instead of hiding them', async () => {
    vi.spyOn(resolver, 'resolveDNS').mockImplementation(async (_d, _t, options) => {
      if (options?.servers?.[0] === '1.1.1.1') {
        return { domain: 'example.com', recordType: DNSRecordType.A, records: [], status: 'timeout', error: 'timeout', queryTime: 5 };
      }
      return lookup(DNSRecordType.A, [{ address: '192.0.2.1' }]);
    });
    const result = await compareResolvers('example.com', DNSRecordType.A);
    expect(result.terminology).toMatch(/not a global propagation/i);
    expect(result.observations).toHaveLength(4);
    expect(result.differences.some((d) => /Cloudflare/.test(d))).toBe(true);
  });
});
