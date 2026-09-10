import { describe, it, expect } from 'vitest';
import { analyzeSPF } from '@/lib/dns/analysis/spf-analyzer';
import * as resolver from '@/lib/dns/resolver/dns-resolver';
import { DNSRecordType } from '@/types/domain';
import { vi } from 'vitest';

describe('SPF analyzer', () => {
  it('flags missing SPF', async () => {
    vi.spyOn(resolver, 'resolveDNS').mockResolvedValue({
      domain: 'example.com',
      recordType: DNSRecordType.TXT,
      records: [['v=google-site-verification=abc']],
      status: 'success',
      queryTime: 1,
    });
    const result = await analyzeSPF('example.com');
    expect(result.findings.some((f) => f.code === 'SPF_MISSING')).toBe(true);
  });

  it('flags duplicate SPF records', async () => {
    vi.spyOn(resolver, 'resolveDNS').mockResolvedValue({
      domain: 'example.com',
      recordType: DNSRecordType.TXT,
      records: [['v=spf1 -all'], ['v=spf1 +all']],
      status: 'success',
      queryTime: 1,
    });
    const result = await analyzeSPF('example.com');
    expect(result.findings.some((f) => f.code === 'SPF_MULTIPLE')).toBe(true);
  });

  it('flags +all', async () => {
    vi.spyOn(resolver, 'resolveDNS').mockResolvedValue({
      domain: 'example.com',
      recordType: DNSRecordType.TXT,
      records: [['v=spf1 +all']],
      status: 'success',
      queryTime: 1,
    });
    const result = await analyzeSPF('example.com');
    expect(result.findings.some((f) => f.code === 'SPF_PLUS_ALL')).toBe(true);
  });

  it('does not claim a sender authorization test', async () => {
    vi.spyOn(resolver, 'resolveDNS').mockResolvedValue({
      domain: 'example.com',
      recordType: DNSRecordType.TXT,
      records: [['v=spf1 -all']],
      status: 'success',
      queryTime: 1,
    });
    const result = await analyzeSPF('example.com');
    expect(result.cryptographicOrSenderTestPerformed).toBe(false);
    expect(result.findings.some((f) => f.code === 'SPF_NO_SENDER_TEST')).toBe(true);
  });
});
