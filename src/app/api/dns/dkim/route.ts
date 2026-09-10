import { NextRequest } from 'next/server';
import { handleApi, parseSearchParams, parseWithSchema, readJsonBody } from '@/lib/errors/api-handler';
import { dkimQuerySchema } from '@/lib/validation/schemas';
import { validateDomain, validateSelector } from '@/lib/validation/domain-validator';
import { analyzeDKIM } from '@/lib/dns/analysis/dkim-analyzer';

async function run(input: unknown) {
  const validated = parseWithSchema(dkimQuerySchema, input);
  const domain = validateDomain(validated.domain);
  const selector = validateSelector(validated.selector);
  return analyzeDKIM(domain, selector);
}

export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(req, () => run(parseSearchParams(req)));
}

export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => run(await readJsonBody(req)));
}
