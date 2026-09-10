import { config } from '@/lib/config';
import { RateLimitError } from '@/lib/errors/app-error';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export interface RateLimiter {
  isAllowed(key: string): boolean;
  getRetryAfterSeconds(key: string): number;
}

export class InMemoryRateLimiter implements RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private windowMs: number;
  private maxRequests: number;

  constructor(
    windowMs: number = config.RATE_LIMIT_WINDOW_MS,
    maxRequests: number = config.RATE_LIMIT_MAX_REQUESTS
  ) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  isAllowed(key: string): boolean {
    this.cleanupIfNeeded();
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now >= entry.resetTime) {
      this.store.set(key, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    if (entry.count < this.maxRequests) {
      entry.count += 1;
      return true;
    }

    return false;
  }

  getRetryAfterSeconds(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return 0;
    return Math.max(1, Math.ceil((entry.resetTime - Date.now()) / 1000));
  }

  private cleanupIfNeeded(): void {
    if (this.store.size < 2000) return;
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

let sharedLimiter: RateLimiter | undefined;

export function createRateLimiter(
  windowMs?: number,
  maxRequests?: number
): RateLimiter {
  return new InMemoryRateLimiter(windowMs, maxRequests);
}

export function getSharedRateLimiter(): RateLimiter {
  if (!sharedLimiter) {
    sharedLimiter = createRateLimiter();
  }
  return sharedLimiter;
}

export function checkRateLimit(limiter: RateLimiter, key: string): void {
  if (!limiter.isAllowed(key)) {
    throw new RateLimitError(
      'Rate limit exceeded. Please try again later.',
      limiter.getRetryAfterSeconds(key)
    );
  }
}
