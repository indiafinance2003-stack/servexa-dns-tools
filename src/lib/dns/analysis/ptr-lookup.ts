import { DNSRecordType, PTRLookupResult } from '@/types/domain';
import { QueryBudget, resolveDNS } from '@/lib/dns/resolver/dns-resolver';
import { validatePublicIP } from '@/lib/validation/domain-validator';
import { parseIP } from '@/lib/net/ip';
import { normalizePTRRecords } from '@/lib/dns/normalization/dns-normalizer';

function reverseName(ip: string): string {
  const parsed = parseIP(ip);
  if (!parsed) return ip;
  if (parsed.version === 4) {
    return `${[...parsed.octets].reverse().join('.')}.in-addr.arpa`;
  }
  const nibbles = parsed.groups
    .map((group) => group.toString(16).padStart(4, '0'))
    .join('')
    .split('')
    .reverse()
    .join('.');
  return `${nibbles}.ip6.arpa`;
}

export async function lookupPTR(ipInput: string, budget?: QueryBudget): Promise<PTRLookupResult> {
  const { canonical } = validatePublicIP(ipInput);
  const name = reverseName(canonical);
  const result = await resolveDNS(name, DNSRecordType.PTR, { budget });
  return {
    ip: canonical,
    ptrs: normalizePTRRecords(result.records),
    status: result.status,
    error: result.error,
    queryTime: result.queryTime,
  };
}
