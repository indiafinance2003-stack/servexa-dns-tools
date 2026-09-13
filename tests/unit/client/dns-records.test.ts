import { describe, expect, it } from 'vitest';
import { buildRecordRows, buildSoaFields, TTL_UNAVAILABLE } from '@/lib/client/dns-records';
import { DNSRecordType } from '@/types/domain';

describe('buildRecordRows — A records', () => {
  it('maps address and TTL from the real backend shape', () => {
    const rows = buildRecordRows(DNSRecordType.A, [{ address: '142.250.182.78', ttl: 114 }], 'google.com');
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('A');
    expect(rows[0].name).toBe('google.com');
    expect(rows[0].value).toBe('142.250.182.78');
    expect(rows[0].ttl).toBe('114s');
  });

  it('shows the unavailable marker when TTL is absent (never fabricated)', () => {
    const rows = buildRecordRows(DNSRecordType.A, [{ address: '1.2.3.4' }], 'example.com');
    expect(rows[0].ttl).toBe(TTL_UNAVAILABLE);
  });

  it('maps AAAA addresses', () => {
    const rows = buildRecordRows(DNSRecordType.AAAA, [{ address: '2607:f8b0:4004:800::200e', ttl: 100 }], 'google.com');
    expect(rows[0].value).toBe('2607:f8b0:4004:800::200e');
    expect(rows[0].type).toBe('AAAA');
  });
});

describe('buildRecordRows — MX, NS, CNAME, TXT, PTR', () => {
  it('renders MX as "priority exchange" like dig output', () => {
    const rows = buildRecordRows(
      DNSRecordType.MX,
      [{ priority: 10, exchange: 'smtp.google.com.', ttl: 300 }],
      'google.com'
    );
    expect(rows[0].value).toBe('10 smtp.google.com');
    expect(rows[0].ttl).toBe('300s');
  });

  it('renders NS nameservers with trailing dots removed', () => {
    const rows = buildRecordRows(DNSRecordType.NS, [{ nameserver: 'ns1.google.com.' }], 'google.com');
    expect(rows[0].value).toBe('ns1.google.com');
    expect(rows[0].ttl).toBe(TTL_UNAVAILABLE);
  });

  it('renders CNAME string targets', () => {
    const rows = buildRecordRows(DNSRecordType.CNAME, ['www.example.com.'], 'example.com');
    expect(rows[0].value).toBe('www.example.com');
    expect(rows[0].ttl).toBe(TTL_UNAVAILABLE);
  });

  it('renders TXT values as strings', () => {
    const rows = buildRecordRows(DNSRecordType.TXT, ['v=spf1 include:_spf.google.com ~all'], 'google.com');
    expect(rows[0].value).toBe('v=spf1 include:_spf.google.com ~all');
  });

  it('renders PTR string records', () => {
    const rows = buildRecordRows(DNSRecordType.PTR, ['dns.google.'], '8.8.8.8.in-addr.arpa');
    expect(rows[0].value).toBe('dns.google');
  });
});

describe('buildRecordRows — SOA, SRV, CAA', () => {
  it('renders SOA with nameserver and serial', () => {
    const rows = buildRecordRows(
      DNSRecordType.SOA,
      [{ nameserver: 'ns1.google.com', hostmaster: 'dns-admin.google.com', serial: 123456, refresh: 900, retry: 900, expire: 1800, minimum: 60 }],
      'google.com'
    );
    expect(rows[0].value).toContain('ns1.google.com');
    expect(rows[0].value).toContain('serial 123456');
    expect(rows[0].ttl).toBe(TTL_UNAVAILABLE);
  });

  it('renders SRV as priority weight port target', () => {
    const rows = buildRecordRows(
      DNSRecordType.SRV,
      [{ priority: 5, weight: 0, port: 443, target: 'sip.example.com' }],
      '_sip._tcp.example.com'
    );
    expect(rows[0].value).toBe('5 0 443 sip.example.com');
  });

  it('renders CAA as flags tag "value"', () => {
    const rows = buildRecordRows(
      DNSRecordType.CAA,
      [{ flags: 0, tag: 'issue', value: 'letsencrypt.org' }],
      'example.com'
    );
    expect(rows[0].value).toBe('0 issue "letsencrypt.org"');
  });

  it('exposes SOA structured fields with unavailable markers for missing values', () => {
    const fields = buildSoaFields({ nameserver: 'ns1.example.com', hostmaster: 'hostmaster.example.com', serial: 42 });
    const labels = fields.map((f) => f.label);
    expect(labels).toContain('Primary nameserver');
    expect(labels).toContain('Responsible mailbox');
    expect(labels).toContain('Serial');
    const recordTtl = fields.find((f) => f.label === 'Record TTL');
    expect(recordTtl?.value).toBe(TTL_UNAVAILABLE);
    const nameserver = fields.find((f) => f.label === 'Primary nameserver');
    expect(nameserver?.value).toBe('ns1.example.com');
  });

  it('returns no SOA fields for non-object input', () => {
    expect(buildSoaFields(null)).toEqual([]);
    expect(buildSoaFields('string')).toEqual([]);
  });
});

describe('buildRecordRows — defensive behavior', () => {
  it('returns empty rows for non-array input', () => {
    expect(buildRecordRows(DNSRecordType.A, null, 'example.com')).toEqual([]);
    expect(buildRecordRows(DNSRecordType.A, undefined, 'example.com')).toEqual([]);
  });

  it('falls back to JSON for unknown record shapes instead of throwing', () => {
    const rows = buildRecordRows('UNKNOWN', [{ weird: 'shape', ttl: 30 }], 'example.com');
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toContain('shape');
    expect(rows[0].ttl).toBe('30s');
  });

  it('renders one row per record for multi-value responses', () => {
    const rows = buildRecordRows(
      DNSRecordType.A,
      [{ address: '1.1.1.1', ttl: 1 }, { address: '2.2.2.2', ttl: 2 }],
      'cloudflare-dns.com'
    );
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.value)).toEqual(['1.1.1.1', '2.2.2.2']);
  });

  it('does not throw on null entries inside the records array', () => {
    const rows = buildRecordRows(DNSRecordType.A, [null], 'example.com');
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe('null');
  });
});
