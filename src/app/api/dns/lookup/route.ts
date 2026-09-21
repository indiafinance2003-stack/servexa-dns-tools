import { NextRequest } from 'next/server';
import { handleApi, parseSearchParams, parseWithSchema, readJsonBody } from '@/lib/errors/api-handler';
import { dnsLookupSchema } from '@/lib/validation/schemas';
import { validateDomain } from '@/lib/validation/domain-validator';
import { resolveDNS } from '@/lib/dns/resolver/dns-resolver';
import { normalizeDNSRecord } from '@/lib/dns/normalization/dns-normalizer';
import { DNSLookupResult, DNSRecordType, DnsLookupRdap } from '@/types/domain';
import { lookupDomainInfo, lookupIpNetwork } from '@/lib/net/rdap';

/**
 * RDAP enrichment for DNS Lookup.
 *
 * The domain's registration record (registrar, expiry, DNSSEC) is always
 * attempted; for A/AAAA results the first few public IP addresses get network
 * (provider) context. RDAP sources are learned from IANA's bootstrap files and
 * every failure degrades to `null` — the UI then reports "not determined"
 * instead of guessing a provider.
 */
async function enrichRdap(
  domain: string,
  recordType: DNSRecordType,
  records: unknown[]
): Promise<DnsLookupRdap> {
  const ipAddresses: string[] = [];
  if (recordType === DNSRecordType.A || recordType === DNSRecordType.AAAA) {
    for (const record of records) {
      if (ipAddresses.length >= 3) break;
      const address = (record as { address?: unknown } | null)?.address;
      if (typeof address === 'string' && address.length > 0 && !ipAddresses.includes(address)) {
        ipAddresses.push(address);
      }
    }
  }

  const [domainResult, ...networkResults] = await Promise.allSettled([
    lookupDomainInfo(domain),
    ...ipAddresses.map((ip) => lookupIpNetwork(ip)),
  ]);

  const networks = networkResults
    .map((result) => (result.status === 'fulfilled' ? result.value : null))
    .filter((value): value is NonNullable<typeof value> => value !== null);

  return {
    domain: domainResult.status === 'fulfilled' ? domainResult.value : null,
    networks,
  };
}

async function runLookup(input: unknown): Promise<DNSLookupResult> {
  const validated = parseWithSchema(dnsLookupSchema, input);
  const domain = validateDomain(validated.domain);
  const result = await resolveDNS(domain, validated.recordType);
  const records = normalizeDNSRecord(validated.recordType, result.records);

  const response: DNSLookupResult = {
    domain,
    recordType: validated.recordType as DNSRecordType,
    records,
    status: result.status,
    ...(result.error ? { error: result.error } : {}),
    queryTime: result.queryTime,
  };

  if (result.status === 'success') {
    response.rdap = await enrichRdap(domain, response.recordType, records);
  }

  return response;
}

export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(req, () => runLookup(parseSearchParams(req)));
}

export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => runLookup(await readJsonBody(req)));
}