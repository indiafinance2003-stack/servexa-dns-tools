import { config } from '@/lib/config';
import { RateLimitError } from '@/lib/errors/app-error';
import { createRateLimiter, type RateLimiter } from '@/lib/security/rate-limit/rate-limiter';
import type { NextRequest } from 'next/server';

/**
 * Authentication-specific rate limiting.
 *
 * - Login is keyed by client identity + submitted email, so a single account
 *   cannot be brute forced even if the request IP is spoofed.
 * - Registration is keyed by client identity.
 *
 * The client identity is derived from X-Forwarded-For only when
 * TRUST_PROXY_HEADERS is enabled (the production deployment sits behind a
 * reverse proxy that sets it). When disabled, requests fall into one shared
 * bucket rather than trusting a client-controlled header.
 */

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_ATTEMPTS = 8;
export const REGISTER_WINDOW_MS = 60 * 60 * 1000;
export const REGISTER_MAX_ATTEMPTS = 5;
export const FORGOT_PASSWORD_WINDOW_MS = 15 * 60 * 1000;
export const FORGOT_PASSWORD_MAX_ATTEMPTS = 5;
export const FORGOT_PASSWORD_CLIENT_WINDOW_MS = 15 * 60 * 1000;
export const FORGOT_PASSWORD_CLIENT_MAX_ATTEMPTS = 10;

let loginLimiter: RateLimiter | undefined;
let registerLimiter: RateLimiter | undefined;
let forgotPasswordLimiter: RateLimiter | undefined;
let forgotPasswordClientLimiter: RateLimiter | undefined;

export function getLoginRateLimiter(): RateLimiter {
  if (!loginLimiter) {
    loginLimiter = createRateLimiter(LOGIN_WINDOW_MS, LOGIN_MAX_ATTEMPTS);
  }
  return loginLimiter;
}

export function getRegisterRateLimiter(): RateLimiter {
  if (!registerLimiter) {
    registerLimiter = createRateLimiter(REGISTER_WINDOW_MS, REGISTER_MAX_ATTEMPTS);
  }
  return registerLimiter;
}

/**
 * Per email+client forgot-password limiter: 5 requests per 15 minutes. Prevents
 * an attacker from hammering a single account with reset requests.
 */
export function getForgotPasswordRateLimiter(): RateLimiter {
  if (!forgotPasswordLimiter) {
    forgotPasswordLimiter = createRateLimiter(
      FORGOT_PASSWORD_WINDOW_MS,
      FORGOT_PASSWORD_MAX_ATTEMPTS
    );
  }
  return forgotPasswordLimiter;
}

/**
 * Broader client-identity forgot-password limiter: 10 requests per 15 minutes
 * regardless of which email is submitted. Stops a single client from probing
 * many different addresses.
 */
export function getForgotPasswordClientRateLimiter(): RateLimiter {
  if (!forgotPasswordClientLimiter) {
    forgotPasswordClientLimiter = createRateLimiter(
      FORGOT_PASSWORD_CLIENT_WINDOW_MS,
      FORGOT_PASSWORD_CLIENT_MAX_ATTEMPTS
    );
  }
  return forgotPasswordClientLimiter;
}

export function clientIdentity(req: NextRequest): string {
  if (config.TRUST_PROXY_HEADERS) {
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded?.split(',')[0]?.trim();
    if (ip) return `ip:${ip.slice(0, 64)}`;
    const realIp = req.headers.get('x-real-ip');
    if (realIp) return `ip:${realIp.slice(0, 64)}`;
  }
  // No trusted proxy: all requests share one bucket (correct, just coarser).
  return 'untrusted';
}

export function loginKey(req: NextRequest, email: string): string {
  return `login:${clientIdentity(req)}:${email}`;
}

export function registerKey(req: NextRequest): string {
  return `register:${clientIdentity(req)}`;
}

export function forgotPasswordKey(req: NextRequest, email: string): string {
  return `forgot-password:${clientIdentity(req)}:${email}`;
}

export function forgotPasswordClientKey(req: NextRequest): string {
  return `forgot-password:${clientIdentity(req)}`;
}

/** Throws a 429 RateLimitError when the limiter rejects the key. */
export function checkAuthRateLimit(
  limiter: RateLimiter,
  key: string,
  message: string
): void {
  if (!limiter.isAllowed(key)) {
    throw new RateLimitError(message, limiter.getRetryAfterSeconds(key));
  }
}
