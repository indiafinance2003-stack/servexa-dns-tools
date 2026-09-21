import { NextRequest, NextResponse } from 'next/server';
import { AppError, AppErrorCode, ValidationError } from '@/lib/errors/app-error';
import { APIResponse } from '@/types/api';
import { logger } from '@/lib/logging/logger';
import { config } from '@/lib/config';
import { checkRateLimit, getSharedRateLimiter } from '@/lib/security/rate-limit/rate-limiter';

export { parseWithSchema } from '@/lib/validation/parse';

export function sendSuccess<T>(data: T, statusCode: number = 200): NextResponse<APIResponse<T>> {
  return NextResponse.json({ success: true, data }, { status: statusCode });
}

export function sendError(error: Error | AppError, statusCode?: number): NextResponse<APIResponse<never>> {
  if (error instanceof AppError) {
    logger.error(`API Error: ${error.code}`, {
      message: error.message,
      code: error.code,
    });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details && { details: error.details }),
        },
      },
      { status: error.statusCode }
    );
  }

  logger.error('Unhandled error', error);
  return NextResponse.json(
    {
      success: false,
      error: {
        code: AppErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
      },
    },
    { status: statusCode || 500 }
  );
}

function clientKey(req: NextRequest): string {
  if (config.TRUST_PROXY_HEADERS) {
    const forwarded = req.headers.get('x-forwarded-for');
    const forwardedIp = forwarded?.split(',')[0]?.trim();
    if (forwardedIp) return forwardedIp.slice(0, 128);
    const realIp = req.headers.get('x-real-ip');
    if (realIp) return realIp.slice(0, 128);
  }
  // Without a trusted reverse proxy, a client-controllable header must not be
  // used as a rate-limit key: spoofing it would reset the bucket.
  return 'untrusted';
}

export function enforceRequestGuards(req: NextRequest): void {
  checkRateLimit(getSharedRateLimiter(), clientKey(req));
  const lengthHeader = req.headers.get('content-length');
  if (lengthHeader) {
    const length = Number(lengthHeader);
    if (Number.isFinite(length) && length > config.MAX_REQUEST_BODY_BYTES) {
      throw new AppError(
        AppErrorCode.REQUEST_TOO_LARGE,
        'Request body too large',
        413,
        { maxSize: config.MAX_REQUEST_BODY_BYTES }
      );
    }
  }
}

export async function readJsonBody(req: NextRequest): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (Buffer.byteLength(text, 'utf8') > config.MAX_REQUEST_BODY_BYTES) {
    throw new AppError(
      AppErrorCode.REQUEST_TOO_LARGE,
      'Request body too large',
      413,
      { maxSize: config.MAX_REQUEST_BODY_BYTES }
    );
  }
  if (!text.trim()) {
    throw new ValidationError('Request body is required');
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ValidationError('JSON body must be an object');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new ValidationError('Invalid JSON in request body');
  }
}

export function parseSearchParams(req: NextRequest): Record<string, string> {
  const params: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

export async function handleApi<T>(
  req: NextRequest,
  runner: () => Promise<T>,
  statusForData?: (data: T) => number
): Promise<NextResponse<APIResponse<T>>> {
  try {
    enforceRequestGuards(req);
    const data = await runner();
    return sendSuccess(data, statusForData ? statusForData(data) : 200);
  } catch (error) {
    if (error instanceof AppError) return sendError(error);
    if (error instanceof Error) return sendError(error);
    return sendError(new Error('Unknown error'));
  }
}
