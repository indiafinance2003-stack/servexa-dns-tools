import { NextRequest } from 'next/server';
import { handleApi, parseSearchParams } from '@/lib/errors/api-handler';
import { parseWithSchema } from '@/lib/validation/parse';
import { listPublicJobs } from '@/lib/talent/public';
import { talentPublicJobQuerySchema } from '@/lib/talent/schemas';

/**
 * GET /api/talent/jobs
 *
 * Public listing of currently OPEN Ravelyth Talent positions. No
 * authentication required; only published, publicly-listable job fields are
 * returned (no client identity, no candidate data).
 */
export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => {
    const query = parseWithSchema(talentPublicJobQuerySchema, parseSearchParams(req));
    const jobs = await listPublicJobs(query);
    return { jobs };
  });
}
