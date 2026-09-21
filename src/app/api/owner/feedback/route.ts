import { NextRequest } from 'next/server';
import { handleApi, parseSearchParams } from '@/lib/errors/api-handler';
import { requireOwner } from '@/lib/admin/guards';
import { listAllFeedback } from '@/lib/feedback/service';

/** GET /api/owner/feedback — Owner-only feedback inbox (status filter opt-in). */
export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => {
    await requireOwner();
    const params = parseSearchParams(req);
    const status = typeof params.status === 'string' && params.status ? params.status : undefined;
    const limit = Number.parseInt(params.limit ?? '50', 10);
    return listAllFeedback({ status, limit: Number.isFinite(limit) ? limit : 50 });
  });
}