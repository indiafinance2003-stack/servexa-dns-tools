import { DNSRecordType, DelegationCheckResult, NSRecord, SOARecord } from '@/types/domain';
import { QueryBudget, resolveDNS } from '@/lib/dns/resolver/dns-resolver';
import {
  normalizeARecords,
  normalizeAAAARecords,
  normalizeNSRecords,
  normalizeSOARecord,
} from '@/lib/dns/normalization/dns-normalizer';
import { finding } from '@/lib/dns/analysis/findings';

/**
 * Nameserver / delegation diagnostics. Reuses the shared DNS resolver and
 * normalizers — no DNS logic is duplicated here. Every observation is derived
 * from records that were actually returned.
 */

function addressesOf(host: string, budget?: QueryBudget): Promise<{
  addresses: string[];
  error?: string;
}> {
  return (async () => {
    const [a, aaaa] = await Promise.all([
      resolveDNS(host, DNSRecordType.A, { budget }),
      resolveDNS(host, DNSRecordType.AAAA, { budget }),
    ]);
    const addresses = [
      ...normalizeARecords(a?.records ?? []).map((record) => record.address),
      ...normalizeAAAARecords(aaaa?.records ?? []).map((record) => record.address),
    ];
    return {
      addresses,
      ...(resolved_error(a, aaaa) ? { error: resolved_error(a, aaaa) as string } : {}),
    };
  })();
}

function resolved_error(
  a: { error?: string; status: string },
  aaaa: { error?: string; status: string }
): string | undefined {
  if (a.status === 'success' || aaaa.status === 'success') return undefined;
  return a.error || aaaa.error || `A returned ${a.status}; AAAA returned ${aaaa.status}.`;
}

export async function checkDelegation(
  domain: string,
  budget?: QueryBudget
): Promise<DelegationCheckResult> {
  const startedAt = Date.now();
  const findings: DelegationCheckResult['findings'] = [];
  const observations: DelegationCheckResult['observations'] = [];
  const notes: string[] = [
    'Results come from the resolvers Ravelyth queried at the time of the request.',
  ];

  const nsLookup = await resolveDNS(domain, DNSRecordType.NS, { budget });
  const nameservers: NSRecord[] =
    nsLookup.status === 'success' ? normalizeNSRecords(nsLookup.records) : [];

  observations.push({
    label: `NS records (${nameservers.length} returned)`,
    severity: nameservers.length === 0 ? 'error' : nameservers.length === 1 ? 'warning' : 'pass',
    detail:
      nameservers.length === 0
        ? 'No NS records were returned for this name.'
        : nameservers.map((ns) => ns.nameserver).join(', '),
  });

  if (nameservers.length === 0) {
    findings.push(
      finding(
        'DELEGATION_NO_NS',
        'error',
        'delegation',
        'No nameserver delegation observed',
        'The NS lookup returned no nameserver hostnames.',
        'Confirm the zone delegation with the DNS provider; without NS records the domain cannot be resolved normally.',
        { evidence: { status: nsLookup.status, error: nsLookup.error } }
      )
    );


  } else if (nameservers.length === 1) {
    findings.push(
      finding(
        'DELEGATION_SINGLE_NS',
        'warning',
        'delegation',
        'Only one nameserver is published',
        'A single nameserver is a single point of failure for resolution.',
        'Publish at least two nameservers on separate infrastructure.'
      )
    );
  } else {
    findings.push(
      finding(
        'DELEGATION_NS_PRESENT',
        'pass',
        'delegation',
        `${nameservers.length} nameservers published`,
        'Multiple nameservers provide redundancy.',
        'Multiple nameservers reduce the risk of a single resolver outage making the domain unresolvable.'
      )
    );
  }

  const nameserverAddresses: DelegationCheckResult['nameserverAddresses'] = [];
  for (const ns of nameservers.slice(0, 8)) {
    const resolved = await addressesOf(ns.nameserver, budget);
    nameserverAddresses.push({
      nameserver: ns.nameserver,
      addresses: resolved.addresses,
      ...(resolved.error ? { error: resolved.error } : {}),
    });
    if (resolved.addresses.length === 0) {
      observations.push({
        label: `${ns.nameserver} address resolution`,
        severity: 'warning',
        detail: resolved.error ?? 'The nameserver hostname did not resolve to an address.',
      });
      findings.push(
        finding(
          'DELEGATION_NS_UNRESOLVED',
          'warning',
          'delegation',
          `Nameserver ${ns.nameserver} did not resolve`,
          'The nameserver hostname published in NS records returned no A/AAAA address.',
          'A nameserver that does not resolve cannot answer queries; verify its address records.'
        )
      );
    }
  }

  const soaLookup = await resolveDNS(domain, DNSRecordType.SOA, { budget });
  const soa: SOARecord | null =
    soaLookup.status === 'success' ? (normalizeSOARecord(soaLookup.records[0]) ?? null) : null;

  const primaryNameserver = {
    name: soa?.nameserver ?? null,
    appearsInNsRecords: null as boolean | null,
    resolvesToAddress: null as boolean | null,
    addresses: [] as string[],
  };


  if (soa?.nameserver) {
    primaryNameserver.appearsInNsRecords = nameservers.some(
      (ns) => ns.nameserver.toLowerCase() === soa.nameserver.toLowerCase()
    );
    if (!primaryNameserver.appearsInNsRecords) {
      findings.push(
        finding(
          'DELEGATION_SOA_MNAME_NOT_IN_NS',
          'info',
          'delegation',
          'SOA primary nameserver is not in the NS set',
          `The SOA MNAME (${soa.nameserver}) is not among the published NS records.`,
          'This is common for hidden-primary setups, where the primary receives zone transfers from secondaries and is intentionally not public.'
        )
      );
    }
    const primaryResolved = await addressesOf(soa.nameserver, budget);
    primaryNameserver.addresses = primaryResolved.addresses;
    primaryNameserver.resolvesToAddress = primaryResolved.addresses.length > 0;
    if (!primaryNameserver.resolvesToAddress) {
      observations.push({
        label: `SOA primary (${soa.nameserver}) address resolution`,
        severity: 'info',
        detail: 'The SOA MNAME did not resolve to an address from this network.',
      });
    }
  }

  return {
    domain,
    nameservers,
    nameserverAddresses,
    soa,
    primaryNameserver,
    singleProvider: computeSingleProvider(nameservers),
    findings,
    observations,
    queryTimeMs: Date.now() - startedAt,
    notes,
  };
}

/**
 * A rough "same DNS provider" signal: nameserver hostnames are grouped by
 * their parent domain (the two trailing labels). This is an observation about
 * the published hostnames only — it cannot know about hosting relationships.
 */
function computeSingleProvider(nameservers: NSRecord[]): boolean | null {
  if (nameservers.length < 2) return null;
  const parentDomains = new Set(
    nameservers.map((ns) => {
      const labels = ns.nameserver.toLowerCase().split('.');
      return labels.slice(-2).join('.');
    })
  );
  return parentDomains.size === 1;
}
