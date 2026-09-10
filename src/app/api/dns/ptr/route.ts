import { NextRequest } from 'next/server';
import { handleApi, parseSearchParams, parseWithSchema, readJsonBody } from '@/lib/errors/api-handler';
import { ptrQuerySchema } from '@/lib/validation/schemas';
import { lookupPTR } from '@/lib/dns/analysis/ptr-lookup';

async function run(input: unknown) {
  const validated = parseWithSchema(ptrQuerySchema, input);
  const ip = validated.ip || validated.hostname || '';
  return lookupPTR(ip);
}

export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(req, () => run(parseSearchParams(req)));
}

export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => run(await readJsonBody(req)));
}
