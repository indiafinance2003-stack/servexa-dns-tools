import { describe, it, expect, vi } from 'vitest';
import { lookupPTR } from '@/lib/dns/analysis/ptr-lookup';
import { ValidationError } from '@/lib/errors/app-error';
import * as resolver from '@/lib/dns/resolver/dns-resolver';
import { DNSRecordType } from '@/types/domain';

describe('PTR lookup', () => {
  it('rejects private IPs before querying', async () => {
    await expect(lookupPTR('192.168.0.1')).rejects.toBeInstanceOf(ValidationError);
  });

  it('queries the reverse zone for a public IP', async () => {
    const spy = vi.spyOn(resolver, 'resolveDNS').mockResolvedValue({
      domain: '8.8.8.8.in-addr.arpa',
      recordType: DNSRecordType.PTR,
      records: ['dns.google.'],
      status: 'success',
      queryTime: 2,
    });
    const result = await lookupPTR('8.8.8.8');
    expect(spy).toHaveBeenCalled();
    expect(result.ptrs).toEqual(['dns.google']);
    expect(result.ip).toBe('8.8.8.8');
  });
});
