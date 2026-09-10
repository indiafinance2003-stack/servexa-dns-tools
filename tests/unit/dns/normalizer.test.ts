import { describe, it, expect } from 'vitest';
import {
  normalizeARecords,
  normalizeAAAARecords,
  normalizeMXRecords,
  normalizeNSRecords,
  normalizeTXTRecords,
  normalizeCAARecords,
  normalizeSOARecord,
} from '@/lib/dns/normalization/dns-normalizer';

describe('DNS Normalization', () => {
  describe('A Records', () => {
    it('should normalize A records from strings', () => {
      const result = normalizeARecords(['192.0.2.1', '192.0.2.2']);
      expect(result).toEqual([{ address: '192.0.2.1' }, { address: '192.0.2.2' }]);
    });

    it('should keep TTL when provided', () => {
      const result = normalizeARecords([{ address: '192.0.2.1', ttl: 300 }]);
      expect(result[0]).toEqual({ address: '192.0.2.1', ttl: 300 });
    });

    it('should handle empty input', () => {
      expect(normalizeARecords([])).toEqual([]);
    });

    it('should handle non-array input', () => {
      expect(normalizeARecords(null as unknown as string[])).toEqual([]);
    });
  });

  describe('AAAA Records', () => {
    it('should normalize AAAA records', () => {
      const result = normalizeAAAARecords(['2001:db8::1']);
      expect(result[0].address).toBe('2001:db8::1');
    });
  });

  describe('MX Records', () => {
    it('should normalize MX records and strip trailing dots', () => {
      const result = normalizeMXRecords([{ priority: 10, exchange: 'mail1.example.com.' }]);
      expect(result[0]).toMatchObject({ priority: 10, exchange: 'mail1.example.com' });
    });
  });

  describe('NS Records', () => {
    it('should normalize NS records', () => {
      const result = normalizeNSRecords(['ns1.example.com.']);
      expect(result[0].nameserver).toBe('ns1.example.com');
    });
  });

  describe('TXT Records', () => {
    it('should join chunked TXT arrays', () => {
      const result = normalizeTXTRecords([['v=spf1 ', 'include:example.com ~all']]);
      expect(result[0]).toBe('v=spf1 include:example.com ~all');
    });
  });

  describe('SOA and CAA', () => {
    it('should normalize SOA', () => {
      const soa = normalizeSOARecord({
        nsname: 'ns1.example.com.',
        hostmaster: 'hostmaster.example.com',
        serial: 1,
        refresh: 3600,
        retry: 600,
        expire: 86400,
        minimum: 300,
      });
      expect(soa?.nameserver).toBe('ns1.example.com');
      expect(soa?.serial).toBe(1);
    });

    it('should normalize CAA issue records', () => {
      const result = normalizeCAARecords([{ critical: true, issue: 'letsencrypt.org' }]);
      expect(result[0]).toEqual({ flags: 1, tag: 'issue', value: 'letsencrypt.org' });
    });
  });
});
