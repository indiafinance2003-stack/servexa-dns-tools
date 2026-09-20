import { AppError, AppErrorCode, RateLimitError } from '@/lib/errors/app-error';
import { requireApiUser } from '@/lib/auth/require-user';
import { createRateLimiter, type RateLimiter } from '@/lib/security/rate-limit/rate-limiter';
import { config } from '@/lib/config';
import { SupportError } from './errors';
import { NotificationError } from '@/lib/notifications/notifications';

/**
 * API-boundary error mapping.
 *
 * Domain errors (`SupportError`, `NotificationError`) keep the domain layer
 * independent of the HTTP layer; this single helper translates them to
 * `AppError` so every route goes through the shared `handleApi` envelope with
 * safe, mapped status codes.
 */
export function toAppError(error: unknown): unknown {
  if (error instanceof SupportError) {
    return new AppError(
      toSupportErrorCode(error.code),
      error.message,
      error.status
    );
  }
  if (error instanceof NotificationError) {
    return new AppError(
      error.code === 'NOTIFICATION_NOT_FOUND'
        ? AppErrorCode.NOT_FOUND
        : AppErrorCode.VALIDATION_ERROR,
      error.message,
      error.status
    );
  }
  return error;
}

/** Maps stable domain codes onto the API error vocabulary. */
function toSupportErrorCode(code: string): AppErrorCode {
  switch (code) {
    case 'TICKET_NOT_FOUND':
      return AppErrorCode.NOT_FOUND;
    case 'MESSAGE_NOT_FOUND':
      return AppErrorCode.NOT_FOUND;
    case 'UNAUTHORIZED_TICKET_ACCESS':
      return AppErrorCode.UNAUTHORIZED;
    case 'INVALID_TICKET_STATE':
      return AppErrorCode.VALIDATION_ERROR;
    case 'SUPPORT_ENTITLEMENT_REQUIRED':
      return AppErrorCode.UNAUTHORIZED;
    case 'SUPPORT_LIMIT_REACHED':
      return AppErrorCode.RATE_LIMIT_EXCEEDED;
    case 'IMPERSONATION_READ_ONLY':
      return AppErrorCode.UNAUTHORIZED;
    default:
      return AppErrorCode.VALIDATION_ERROR;
  }
}

/**
 * Wraps a domain operation so domain errors are rethrown as mapped AppErrors.
 * Returns a closure (rather than executing immediately) so it can be handed
 * straight to `handleApi(req, withSupportErrors(async () => ...))`.
 */
export function withSupportErrors<T>(fn: () => Promise<T>): () => Promise<T> {
  return async () => {
    try {
      return await fn();
    } catch (error) {
      throw toAppError(error);
    }
  };
}

/** Resolves the acting user from the session cookie, or throws 401. */
export async function requireSupportUser() {
  const user = await requireApiUser();
  if (!user) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, 'Sign in to use the support portal.', 401);
  }
  return user;
}

let ticketCreateLimiter: RateLimiter | undefined;

/**
 * Per-account throttle for ticket creation. Keyed by the session user id (not
 * a client-supplied value), so rotating identities or spoofed IPs cannot reset
 * the bucket, and one compromised account cannot flood the queue.
 */
export function checkTicketCreateRateLimit(userId: string): void {
  if (!ticketCreateLimiter) {
    ticketCreateLimiter = createRateLimiter(
      config.SUPPORT_TICKET_RATE_LIMIT_WINDOW_MS,
      config.SUPPORT_TICKET_RATE_LIMIT_MAX
    );
  }
  const key = `ticket-create:${userId}`;
  if (!ticketCreateLimiter.isAllowed(key)) {
    throw new RateLimitError(
      'Too many support requests were submitted from this account. Please try again later.',
      ticketCreateLimiter.getRetryAfterSeconds(key)
    );
  }
}

/** UUID guard for dynamic route segments (ticket ids, notification ids). */
export function assertUuid(id: string): void {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ) {
    throw new AppError(AppErrorCode.VALIDATION_ERROR, 'Invalid resource id.', 400);
  }
}

/** Backwards-compatible alias for ticket route segments. */
export const assertTicketId = assertUuid;