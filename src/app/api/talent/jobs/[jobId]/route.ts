import { NextRequest } from 'next/server';
import { handleApi } from '@/lib/errors/api-handler';
import { getPublicJobByCode } from '@/lib/talent/public';
import { withTalentErrors } from '@/lib/talent/api';

/**
 * GET /api/talent/jobs/[jobId]
 *
 * Public detail for one job, addressed by its human-readable code (JOB-001).
 * Returns only publicly publishable fields; unknown or non-public codes yield
 * 404 without leaking whether the job exists in another state.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ jobId: string }> }
): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      const { jobId } = await ctx.params;
      // `getPublicJobByCode` normalizes and validates the code itself, so no
      // caller-supplied value is ever used directly in a query.
      const job = await getPublicJobByCode(jobId);
      return { job };
    })
  );
}
