import { NextRequest } from 'next/server';
import { handleApi, parseSearchParams, parseWithSchema, readJsonBody } from '@/lib/errors/api-handler';
import { domainQuerySchema } from '@/lib/validation/schemas';
import { validateDomain } from '@/lib/validation/domain-validator';
import { analyzeSPF } from '@/lib/dns/analysis/spf-analyzer';

async function run(input: unknown) {
  const validated = parseWithSchema(domainQuerySchema, input);
  const domain = validateDomain(validated.domain);
  return analyzeSPF(domain);
}

export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(req, () => run(parseSearchParams(req)));
}

export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => run(await readJsonBody(req)));
}
