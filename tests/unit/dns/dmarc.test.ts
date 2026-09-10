import { describe, it, expect } from 'vitest';
import { parseDMARCRecord, isDmarcRecord } from '@/lib/dns/analysis/dmarc-parser';
import { analyzeDMARC } from '@/lib/dns/analysis/dmarc-analyzer';
import * as resolver from '@/lib/dns/resolver/dns-resolver';
import { DNSRecordType } from '@/types/domain';
import { vi } from 'vitest';

describe('DMARC', () => {
  it('parses common tags', () => {
    const parsed = parseDMARCRecord('v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; adkim=s; aspf=r; pct=100');
    expect(parsed.valid).toBe(true);
    expect(parsed.policy).toBe('quarantine');
    expect(parsed.dkimAlignment).toBe('s');
    expect(parsed.rua?.[0]).toContain('mailto:');
  });

  it('detects malformed records', () => {
    const parsed = parseDMARCRecord('v=DMARC1; p=drop');
    expect(parsed.valid).toBe(false);
    expect(parsed.errors.join(' ')).toMatch(/Invalid p=/);
  });

  it('requires a policy tag', () => {
    const parsed = parseDMARCRecord('v=DMARC1; rua=mailto:dmarc@example.com');
    expect(parsed.valid).toBe(false);
  });

  it('identifies DMARC TXT', () => {
    expect(isDmarcRecord('v=DMARC1; p=none')).toBe(true);
  });

  it('flags duplicates from DNS', async () => {
    vi.spyOn(resolver, 'resolveDNS').mockResolvedValue({
      domain: '_dmarc.example.com',
      recordType: DNSRecordType.TXT,
      records: [['v=DMARC1; p=none'], ['v=DMARC1; p=reject']],
      status: 'success',
      queryTime: 1,
    });
    const result = await analyzeDMARC('example.com');
    expect(result.findings.some((f) => f.code === 'DMARC_MULTIPLE')).toBe(true);
  });
});
