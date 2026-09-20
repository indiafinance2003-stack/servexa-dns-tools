import { AppError, AppErrorCode } from '@/lib/errors/app-error';
import { createRateLimiter, type RateLimiter } from '@/lib/security/rate-limit/rate-limiter';
import { config } from '@/lib/config';
import { TalentError } from './errors';

/**
 * API-boundary error mapping for Ravelyth Talent routes.
 *
 * Domain errors (`TalentError`) stay independent of HTTP; this translates them
 * into the shared `AppError` vocabulary so every route emits the same JSON
 * envelope via `handleApi`.
 */
export function toAppError(error: unknown): unknown {
  if (error instanceof TalentError) {
    const code = (() => {
      switch (error.code) {
        case 'TALENT_NOT_FOUND':
          return AppErrorCode.NOT_FOUND;
        case 'TALENT_APPLICATION_LIMIT_REACHED':
          return AppErrorCode.RATE_LIMIT_EXCEEDED;
        case 'TALENT_JOB_NOT_OPEN':
        case 'TALENT_INVALID_TRANSITION':
        case 'TALENT_SUBMISSION_NOT_CONFIRMED':
          return AppErrorCode.VALIDATION_ERROR;
        case 'TALENT_DUPLICATE_APPLICATION':
          return AppErrorCode.EMAIL_TAKEN;
        default:
          return AppErrorCode.VALIDATION_ERROR;
      }
    })();
    return new AppError(code, error.message, error.status);
  }
  return error;
}

/** Wraps a talent domain operation for use with `handleApi`. */
export function withTalentErrors<T>(fn: () => Promise<T>): () => Promise<T> {
  return async () => {
    try {
      return await fn();
    } catch (error) {
      throw toAppError(error);
    }
  };
}

let applicationLimiter: RateLimiter | undefined;

/**
 * Per-client throttle for public (unauthenticated) applications. Keyed by the
 * client IP derived once in `clientKeyOf`; spoofing headers cannot reset the
 * bucket unless TRUST_PROXY_HEADERS explicitly allows it.
 */
export function checkApplicationRateLimit(key: string): void {
  if (!applicationLimiter) {
    applicationLimiter = createRateLimiter(
      config.TALENT_APPLICATION_RATE_LIMIT_WINDOW_MS,
      config.TALENT_APPLICATION_RATE_LIMIT_MAX
    );
  }
  if (!applicationLimiter.isAllowed(`talent-apply:${key}`)) {
    throw new AppError(
      AppErrorCode.RATE_LIMIT_EXCEEDED,
      'Too many applications were submitted recently. Please try again later.',
      429
    );
  }
}

/** Stable per-client key for unauthenticated application submissions. */
export function clientKeyOf(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'local';
  return ip.slice(0, 128);
}
