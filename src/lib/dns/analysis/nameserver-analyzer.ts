import { DNSLookupStatus, DNSRecordType, NameserverAnalysis, NameserverDetail } from '@/types/domain';
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
    let lookupStatus: DNSLookupStatus = 'success';
    let error: string | undefined;
    if (!resolved) {
      const failed = [a, aaaa].find(
        (item) =>
          item.status === 'servfail' ||
          item.status === 'refused' ||
          item.status === 'timeout' ||
          item.status === 'error'
      );
      if (failed) {
        lookupStatus = failed.status;
        error = failed.error;
      } else if (a.status === 'nxdomain' || aaaa.status === 'nxdomain') {
        lookupStatus = 'nxdomain';
        error = a.status === 'nxdomain' ? a.error : aaaa.error;
      } else {
        lookupStatus = 'empty';
        error = a.error || aaaa.error;
      }
    }
    nameservers.push({
      hostname: host,
      addresses,
      resolved,
      lookupStatus,
      error,
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

  const cleanUnresolved = nameservers.filter(
    (ns) => !ns.resolved && (ns.lookupStatus === 'empty' || ns.lookupStatus === 'nxdomain')
  );
  if (cleanUnresolved.length > 0) {
    findings.push(
      finding(
        'NS_UNRESOLVED',
        'error',
        'nameserver',
        'Nameserver hostname did not resolve',
        cleanUnresolved.map((ns) => ns.hostname).join(', '),
        'A nameserver hostname that has no A/AAAA record cannot be reached using standard lookups. This observation is from a single resolver.',
        { evidence: { unresolved: cleanUnresolved.map((ns) => ({ hostname: ns.hostname, status: ns.lookupStatus })) } }
      )
    );
  }

  const lookupFailures = nameservers.filter(
    (ns) =>
      !ns.resolved &&
      (ns.lookupStatus === 'servfail' ||
        ns.lookupStatus === 'refused' ||
        ns.lookupStatus === 'timeout' ||
        ns.lookupStatus === 'error')
  );
  if (lookupFailures.length > 0) {
    findings.push(
      finding(
        'NS_IP_LOOKUP_FAILED',
        'warning',
        'nameserver',
        'Nameserver address lookup failed',
        `${lookupFailures.map((ns) => ns.hostname).join(', ')} (${[...new Set(lookupFailures.map((ns) => ns.lookupStatus))].join(', ')})`,
        'The resolver did not answer the A/AAAA queries, so the nameserver cannot be confirmed reachable or unreachable either way.',
        { evidence: { failures: lookupFailures.map((ns) => ({ hostname: ns.hostname, status: ns.lookupStatus, error: ns.error })) } }
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
