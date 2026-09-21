import { describe, it, expect, vi } from 'vitest';
import { analyzeDNS } from '@/lib/dns/analysis/dns-analyzer';
import { analyzeNameservers } from '@/lib/dns/analysis/nameserver-analyzer';
import { inspectDnssec } from '@/lib/dns/analysis/dnssec-inspector';
import { analyzeDMARC } from '@/lib/dns/analysis/dmarc-analyzer';
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

  it('distinguishes a failed IP lookup (servfail/timeout) from a clean empty answer', async () => {
    vi.spyOn(resolver, 'resolveDNS').mockImplementation(async (name, type) => {
      if (type === DNSRecordType.NS) return lookup(type, ['ns1.example.com']);
      return { domain: name, recordType: type, records: [], status: 'timeout', error: 'timeout', queryTime: 1 };
    });
    const result = await analyzeNameservers('example.com');
    const host = result.nameservers[0];
    expect(host.lookupStatus).toBe('timeout');
    expect(result.findings.some((f) => f.code === 'NS_IP_LOOKUP_FAILED')).toBe(true);
    expect(result.findings.some((f) => f.code === 'NS_UNRESOLVED')).toBe(false);
  });

  it('flags cleanly-unresolved hostnames (NXDOMAIN = confirmed absent), not as a lookup failure', async () => {
    vi.spyOn(resolver, 'resolveDNS').mockImplementation(async (name, type) => {
      if (type === DNSRecordType.NS) return lookup(type, ['ns1.example.com']);
      return { domain: name, recordType: type, records: [], status: 'nxdomain', error: 'NXDOMAIN', queryTime: 1 };
    });
    const result = await analyzeNameservers('example.com');
    const host = result.nameservers[0];
    expect(host.lookupStatus).toBe('nxdomain');
    expect(result.findings.some((f) => f.code === 'NS_UNRESOLVED')).toBe(true);
    expect(result.findings.some((f) => f.code === 'NS_IP_LOOKUP_FAILED')).toBe(false);
  });
});

describe('DNS failure schooling', () => {
  it('reports NXDOMAIN honestly and suppresses absence claims for missing records', async () => {
    vi.spyOn(resolver, 'resolveDNS').mockImplementation(async (name, type) => {
      return { domain: name, recordType: type, records: [], status: 'nxdomain', error: 'NXDOMAIN', queryTime: 1 };
    });
    const result = await analyzeDNS('nonexistent.example');
    expect(result.findings.some((f) => f.code === 'DOMAIN_NXDOMAIN')).toBe(true);
    expect(result.findings.some((f) => f.code === 'A_MISSING')).toBe(false);
    expect(result.findings.some((f) => f.code === 'AAAA_MISSING')).toBe(false);
    expect(result.findings.some((f) => f.code === 'MX_MISSING')).toBe(false);
    expect(result.lookupStatus.A).toBe('nxdomain');
  });

  it('reports a failed record lookup as a warning instead of claiming the record is missing', async () => {
    vi.spyOn(resolver, 'resolveDNS').mockImplementation(async (name, type) => {
      if (type === DNSRecordType.A) return lookup(type, [{ address: '192.0.2.1', ttl: 60 }]);
      if (type === DNSRecordType.MX) {
        return { domain: name, recordType: type, records: [], status: 'servfail', error: 'servfail', queryTime: 1 };
      }
      return { domain: name, recordType: type, records: [], status: 'empty', queryTime: 1 };
    });
    const result = await analyzeDNS('example.com');
    expect(result.findings.some((f) => f.code === 'MX_LOOKUP_FAILED')).toBe(true);
    expect(result.findings.some((f) => f.code === 'MX_MISSING')).toBe(false);
    expect(result.lookupStatus.MX).toBe('servfail');
  });
});

describe('DMARC analysis', () => {
  it('treats a clean NXDOMAIN for the _dmarc name as an absent policy, not a failed lookup', async () => {
    vi.spyOn(resolver, 'resolveDNS').mockImplementation(async (name, _type) => {
      return { domain: name, recordType: DNSRecordType.TXT, records: [], status: 'nxdomain', error: 'NXDOMAIN', queryTime: 1 };
    });
    const result = await analyzeDMARC('example.com');
    expect(result.findings.some((f) => f.code === 'DMARC_MISSING')).toBe(true);
    expect(result.findings.some((f) => f.code === 'DMARC_LOOKUP_FAILED')).toBe(false);
    expect(result.findings.find((f) => f.code === 'DMARC_MISSING')).toEqual(
      expect.objectContaining({
        evidence: expect.objectContaining({ lookupStatus: 'nxdomain' }),
      })
    );
  });

  it('reports a resolver failure (servfail/timeout) as DMARC_LOOKUP_FAILED', async () => {
    vi.spyOn(resolver, 'resolveDNS').mockImplementation(async (name, _type) => {
      return { domain: name, recordType: DNSRecordType.TXT, records: [], status: 'refused', error: 'refused', queryTime: 1 };
    });
    const result = await analyzeDMARC('example.com');
    expect(result.findings.some((f) => f.code === 'DMARC_LOOKUP_FAILED')).toBe(true);
    expect(result.findings.some((f) => f.code === 'DMARC_MISSING')).toBe(false);
  });
});

describe('DNSSEC inspection', () => {
  it('reports that DNSSEC status cannot be determined without claiming absence', async () => {
    const result = await inspectDnssec('example.com');
    expect(result.determination).toBe('could_not_be_determined');
    expect(result.cryptographicValidationPerformed).toBe(false);
    expect(result.dsRecords).toEqual([]);
    expect(result.dnskeyRecords).toEqual([]);
    expect(result.rrsigObserved).toBe(false);
    expect(result.findings.some((f) => f.code === 'DNSSEC_NOT_INSPECTED')).toBe(true);
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
