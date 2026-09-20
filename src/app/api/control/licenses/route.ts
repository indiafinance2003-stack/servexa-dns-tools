import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleApi, readJsonBody } from '@/lib/errors/api-handler';
import { parseWithSchema } from '@/lib/validation/parse';
import { requireOwner } from '@/lib/admin/guards';
import { issueLicense } from '@/lib/control/licensing';

const issueLicenseSchema = z.object({
  customerId: z.string().uuid().nullish(),
  organizationId: z.string().uuid().nullish(),
  capabilities: z.record(z.unknown()).optional(),
});

/**
 * POST /api/control/licenses
 * Issue a new license key. Owner-only.
 */
export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => {
    const actor = await requireOwner();
    const body = await readJsonBody(req);
    const input = parseWithSchema(issueLicenseSchema, body);
    const result = await issueLicense(actor.id, input);
    return result;
  }, () => 201);
}

/**
 * GET /api/control/licenses
 * List licenses. Owner-only. (Stub — no list endpoint in licensing.ts yet.)
 */
export async function GET(_req: NextRequest): Promise<Response> {
  return handleApi(_req, async () => {
    await requireOwner();
    return { licenses: [] };
  });
}
