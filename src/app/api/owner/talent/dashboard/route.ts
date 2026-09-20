import { NextRequest } from 'next/server';
import { handleApi } from '@/lib/errors/api-handler';
import { requireOwner } from '@/lib/admin/guards';
import { withTalentErrors } from '@/lib/talent/api';
import { talentDashboardMetrics } from '@/lib/talent/dashboard';

/**
 * GET /api/owner/talent/dashboard
 * Owner-only Talent dashboard metrics. Every number is a real database
 * aggregate — no simulated data is ever returned.
 */
export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      await requireOwner();
      const metrics = await talentDashboardMetrics();
      return { metrics };
    })
  );
}
