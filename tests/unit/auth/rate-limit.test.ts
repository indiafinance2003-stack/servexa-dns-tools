import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryRateLimiter } from '@/lib/security/rate-limit/rate-limiter';

/**
 * Behavioral tests for the shared limiter used by authentication endpoints:
 * requests are allowed up to the configured threshold within a window, then
 * blocked until the window resets.
 */
describe('InMemoryRateLimiter (auth behavior)', () => {
  const windowMs = 1000;

  afterEach(() => {
    // vitest restoreMocks is enabled; nothing persistent to clean.
  });

  it('allows requests up to the limit, then blocks', () => {
    const limiter = new InMemoryRateLimiter(windowMs, 3);
    expect(limiter.isAllowed('user@example.com')).toBe(true);
    expect(limiter.isAllowed('user@example.com')).toBe(true);
    expect(limiter.isAllowed('user@example.com')).toBe(true);
    expect(limiter.isAllowed('user@example.com')).toBe(false);
    // A blocked key stays blocked inside the same window.
    expect(limiter.isAllowed('user@example.com')).toBe(false);
  });

  it('tracks keys independently (per email / per IP buckets)', () => {
    const limiter = new InMemoryRateLimiter(windowMs, 2);
    expect(limiter.isAllowed('login:1.2.3.4:user@example.com')).toBe(true);
    expect(limiter.isAllowed('login:1.2.3.4:user@example.com')).toBe(true);
    expect(limiter.isAllowed('login:1.2.3.4:user@example.com')).toBe(false);
    // A different account or IP is unaffected.
    expect(limiter.isAllowed('login:1.2.3.4:other@example.com')).toBe(true);
    expect(limiter.isAllowed('login:5.6.7.8:user@example.com')).toBe(true);
  });

  it('resets after the window elapses', async () => {
    const limiter = new InMemoryRateLimiter(50, 1);
    expect(limiter.isAllowed('key')).toBe(true);
    expect(limiter.isAllowed('key')).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(limiter.isAllowed('key')).toBe(true);
  });

  it('reports retry-after seconds for blocked keys', () => {
    const limiter = new InMemoryRateLimiter(10_000, 1);
    limiter.isAllowed('key');
    limiter.isAllowed('key');
    const retry = limiter.getRetryAfterSeconds('key');
    expect(retry).toBeGreaterThanOrEqual(1);
    expect(retry).toBeLessThanOrEqual(10);
  });

  it('returns zero retry-after for unknown keys', () => {
    const limiter = new InMemoryRateLimiter(windowMs, 1);
    expect(limiter.getRetryAfterSeconds('never-seen')).toBe(0);
  });
});
