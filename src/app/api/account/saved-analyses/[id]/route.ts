import { NextRequest } from 'next/server';
import { handleApi } from '@/lib/errors/api-handler';
import { AppError, AppErrorCode } from '@/lib/errors/app-error';
import { requireApiUser } from '@/lib/auth/require-user';
import { deleteSavedAnalysis } from '@/lib/account/saved-analyses';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Deletes one of the signed-in user's own saved analyses. */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  return handleApi(req, async () => {
    const user = await requireApiUser();
    if (!user) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, 'Sign in to manage saved analyses.', 401);
    }

    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) {
      throw new AppError(AppErrorCode.VALIDATION_ERROR, 'Invalid saved analysis id.', 400);
    }

    const deleted = await deleteSavedAnalysis(user.id, id);
    if (!deleted) {
      throw new AppError(AppErrorCode.VALIDATION_ERROR, 'Saved analysis not found.', 404);
    }
    return { deleted: true };
  });
}
