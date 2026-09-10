import { NextRequest } from 'next/server';
import { handleApi, parseSearchParams, parseWithSchema, readJsonBody } from '@/lib/errors/api-handler';
import { dnsLookupSchema } from '@/lib/validation/schemas';
import { validateDomain } from '@/lib/validation/domain-validator';
import { resolveDNS } from '@/lib/dns/resolver/dns-resolver';
import { normalizeDNSRecord } from '@/lib/dns/normalization/dns-normalizer';
import { DNSRecordType } from '@/types/domain';

async function runLookup(input: unknown) {
  const validated = parseWithSchema(dnsLookupSchema, input);
  const domain = validateDomain(validated.domain);
  const result = await resolveDNS(domain, validated.recordType);
  const records = normalizeDNSRecord(validated.recordType, result.records);
  return {
    domain,
    recordType: validated.recordType as DNSRecordType,
    records,
    status: result.status,
    ...(result.error ? { error: result.error } : {}),
    queryTime: result.queryTime,
  };
}

export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(req, () => runLookup(parseSearchParams(req)));
}

export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => runLookup(await readJsonBody(req)));
}
