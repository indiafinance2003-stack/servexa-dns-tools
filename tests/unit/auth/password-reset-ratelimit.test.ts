import { describe, expect, it } from 'vitest';
import {
  checkAuthRateLimit,
  forgotPasswordClientKey,
  forgotPasswordKey,
  FORGOT_PASSWORD_CLIENT_MAX_ATTEMPTS,
  FORGOT_PASSWORD_MAX_ATTEMPTS,
  getForgotPasswordClientRateLimiter,
  getForgotPasswordRateLimiter,
} from '@/lib/auth/rate-limit';
import { InMemoryRateLimiter } from '@/lib/security/rate-limit/rate-limiter';
import { RateLimitError } from '@/lib/errors/app-error';

function fakeRequest(ip: string): Parameters<typeof forgotPasswordKey>[0] {
  return {
    headers: new Headers({ 'x-forwarded-for': ip }),
  } as unknown as Parameters<typeof forgotPasswordKey>[0];
}

describe('forgot-password rate limiters', () => {
  it('per-email/client limiter uses the existing auth abstraction (5 per window)', () => {
    expect(FORGOT_PASSWORD_MAX_ATTEMPTS).toBe(5);
    const limiter = getForgotPasswordRateLimiter();
    expect(typeof limiter.isAllowed).toBe('function');
    expect(typeof limiter.getRetryAfterSeconds).toBe('function');
  });

  it('per-client limiter uses the existing auth abstraction (10 per window)', () => {
    expect(FORGOT_PASSWORD_CLIENT_MAX_ATTEMPTS).toBe(10);
    const limiter = getForgotPasswordClientRateLimiter();
    expect(typeof limiter.isAllowed).toBe('function');
  });

  it('consumes allowance for every reset request until the limit, then throws 429', () => {
    const limiter = new InMemoryRateLimiter(60_000, 2);
    checkAuthRateLimit(limiter, 'forgot-password:untrusted:user@example.com', 'Too many');
    checkAuthRateLimit(limiter, 'forgot-password:untrusted:user@example.com', 'Too many');
    expect(() =>
      checkAuthRateLimit(limiter, 'forgot-password:untrusted:user@example.com', 'Too many')
    ).toThrow(RateLimitError);
    // Unsuccessful (rejected) attempts also consumed allowance: a different
    // key is unaffected while the exhausted key stays blocked.
    expect(limiter.isAllowed('forgot-password:untrusted:user@example.com')).toBe(false);
    expect(limiter.isAllowed('forgot-password:untrusted:other@example.com')).toBe(true);
  });

  it('keys isolate per email+client and per client buckets', () => {
    const req = fakeRequest('9.9.9.9');
    const emailKey = forgotPasswordKey(req, 'user@example.com');
    const clientKey = forgotPasswordClientKey(req);
    expect(typeof emailKey).toBe('string');
    expect(typeof clientKey).toBe('string');
    expect(emailKey).not.toBe(clientKey);
    expect(forgotPasswordKey(req, 'a@example.com')).not.toBe(
      forgotPasswordKey(req, 'b@example.com')
    );
  });
});
