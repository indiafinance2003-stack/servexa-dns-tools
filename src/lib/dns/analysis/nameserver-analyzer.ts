import { DNSRecordType, NameserverAnalysis, NameserverDetail } from '@/types/domain';
import { QueryBudget, resolveDNS } from '@/lib/dns/resolver/dns-resolver';
import { normalizeARecords, normalizeAAAARecords, normalizeNSRecords } from '@/lib/dns/normalization/dns-normalizer';
import { finding } from '@/lib/dns/analysis/findings';

export async function analyzeNameservers(
  domain: string,
  budget?: QueryBudget
): Promise<NameserverAnalysis> {
  const nsLookup = await resolveDNS(domain, DNSRecordType.NS, { budget });
  const findings: NameserverAnalysis['findings'] = [];

  if (nsLookup.status !== 'success') {
    findings.push(
      finding(
        'NS_MISSING_OR_FAILED',
        nsLookup.status === 'empty' || nsLookup.status === 'nxdomain' ? 'error' : 'warning',
        'nameserver',
        'Nameserver lookup unsuccessful',
        `NS lookup returned ${nsLookup.status}.`,
        'Authoritative nameserver hostnames could not be listed from this resolver.',
        { evidence: { error: nsLookup.error } }
      )
    );
    return { nameservers: [], findings };
  }

  const nsRecords = normalizeNSRecords(nsLookup.records);
  const nameservers: NameserverDetail[] = [];

  for (const ns of nsRecords) {
    const host = ns.nameserver;
    const a = await resolveDNS(host, DNSRecordType.A, { budget });
    const aaaa = await resolveDNS(host, DNSRecordType.AAAA, { budget });
    const addresses = [
      ...normalizeARecords(a?.records ?? []).map((r) => r.address),
      ...normalizeAAAARecords(aaaa?.records ?? []).map((r) => r.address),
    ];
    const resolved = addresses.length > 0;
    nameservers.push({
      hostname: host,
      addresses,
      resolved,
      lookupStatus: resolved ? 'success' : a?.status === 'timeout' || aaaa?.status === 'timeout' ? 'timeout' : 'empty',
      error: resolved ? undefined : a?.error || aaaa?.error,
    });
  }

  if (nameservers.length === 0) {
    findings.push(
      finding(
        'NS_MISSING',
        'error',
        'nameserver',
        'No NS records',
        'The resolver returned no nameserver hostnames.',
        'A zone typically publishes at least two NS records.'
      )
    );
  } else if (nameservers.length === 1) {
    findings.push(
      finding(
        'NS_SINGLE',
        'warning',
        'nameserver',
        'Only one nameserver hostname',
        `${nameservers[0].hostname} is the only NS hostname observed.`,
        'Best practice is at least two nameservers, preferably on separate networks. This observation is from a single resolver.'
      )
    );
  } else {
    findings.push(
      finding(
        'NS_PRESENT',
        'pass',
        'nameserver',
        'Nameserver hostnames published',
        `${nameservers.length} NS hostnames were observed.`,
        'This is not a measurement of global consistency or all anycast instances.'
      )
    );
  }

  const unresolved = nameservers.filter((ns) => !ns.resolved);
  if (unresolved.length > 0) {
    findings.push(
      finding(
        'NS_UNRESOLVED',
        'error',
        'nameserver',
        'Nameserver hostname did not resolve',
        unresolved.map((ns) => ns.hostname).join(', '),
        'A nameserver hostname that does not resolve to an address cannot be reached using standard A/AAAA lookups from this resolver.',
        { evidence: { unresolved } }
      )
    );
  }

  const uniqueAddresses = new Set(nameservers.flatMap((ns) => ns.addresses));
  if (nameservers.length > 1 && uniqueAddresses.size === 1) {
    findings.push(
      finding(
        'NS_SAME_ADDRESS',
        'warning',
        'nameserver',
        'Nameservers share a single observed address',
        `All resolved nameservers pointed at ${[...uniqueAddresses][0]}.`,
        'This may be intentional anycast, or it may indicate a lack of diversity. Only addresses visible to this resolver were compared.'
      )
    );
  }

  return { nameservers, findings };
}
