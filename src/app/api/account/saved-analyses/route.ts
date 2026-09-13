import { NextRequest, NextResponse } from 'next/server';
import { handleApi, readJsonBody } from '@/lib/errors/api-handler';
import { AppError, AppErrorCode } from '@/lib/errors/app-error';
import { APIResponse } from '@/types/api';
import { requireApiUser } from '@/lib/auth/require-user';
import {
  createSavedAnalysis,
  listSavedAnalyses,
  savedAnalysisInputSchema,
} from '@/lib/account/saved-analyses';
import { parseWithSchema } from '@/lib/validation/parse';

function unauthorized(): AppError {
  return new AppError(AppErrorCode.UNAUTHORIZED, 'Sign in to manage saved analyses.', 401);
}

/** Lists the signed-in user's saved analyses. Users only ever see their own. */
export async function GET(): Promise<Response> {
  try {
    const user = await requireApiUser();
    if (!user) throw unauthorized();
    const analyses = await listSavedAnalyses(user.id);
    return NextResponse.json(
      { success: true, data: { analyses } } satisfies APIResponse<{ analyses: unknown }>
    );
  } catch (error) {
    return handleApiError(error);
  }
}

/** Saves an explicitly initiated analysis for the signed-in user. */
export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => {
    const user = await requireApiUser();
    if (!user) throw unauthorized();

    const body = await readJsonBody(req);
    const input = parseWithSchema(savedAnalysisInputSchema, body);
    return createSavedAnalysis(user.id, input);
  }, () => 201);
}

export async function DELETE(): Promise<Response> {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: AppErrorCode.UNSUPPORTED_OPERATION,
        message: 'Delete a specific saved analysis by id.',
      },
    } satisfies APIResponse<never>,
    { status: 400 }
  );
}

async function handleApiError(error: unknown): Promise<Response> {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details }),
        },
      } satisfies APIResponse<never>,
      { status: error.statusCode }
    );
  }
  return NextResponse.json(
    {
      success: false,
      error: { code: AppErrorCode.INTERNAL_ERROR, message: 'Internal server error' },
    } satisfies APIResponse<never>,
    { status: 500 }
  );
}
