import { NextRequest } from 'next/server';
import { handleApi, parseSearchParams, parseWithSchema, readJsonBody } from '@/lib/errors/api-handler';
import { resolverComparisonSchema } from '@/lib/validation/schemas';
import { validateDomain } from '@/lib/validation/domain-validator';
import { compareResolvers } from '@/lib/dns/analysis/resolver-comparison';
import { DNSRecordType } from '@/types/domain';

async function run(input: unknown) {
  const validated = parseWithSchema(resolverComparisonSchema, input);
  const domain = validateDomain(validated.domain);
  return compareResolvers(domain, validated.recordType ?? DNSRecordType.A);
}

export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(req, () => run(parseSearchParams(req)));
}

export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => run(await readJsonBody(req)));
}
