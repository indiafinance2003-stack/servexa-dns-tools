import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleApi, readJsonBody } from '@/lib/errors/api-handler';
import { parseWithSchema } from '@/lib/validation/parse';
import { validateLicense, getLicenseCapabilities } from '@/lib/control/licensing';

const validateSchema = z.object({
  licenseKey: z.string().min(1),
});

/**
 * POST /api/control/licenses/validate
 * Validates a license key. No owner auth — this is called by agents/Clients
 * presenting their license key.
 */
export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => {
    const body = await readJsonBody(req);
    const input = parseWithSchema(validateSchema, body);
    const license = await validateLicense(input.licenseKey);
    if (!license) {
      return { valid: false, capabilities: null };
    }
    const capabilities = await getLicenseCapabilities(input.licenseKey);
    return {
      valid: true,
      keyPrefix: license.keyPrefix,
      status: license.status,
      expiresAt: license.expiresAt ?? null,
      capabilities,
    };
  });
}
