import { describe, expect, it } from 'vitest';
import { generateSessionToken, hashSessionToken, safeEqual } from '@/lib/auth/tokens';

describe('session tokens', () => {
  it('generates high-entropy URL-safe tokens', () => {
    const token = generateSessionToken();
    // 32 random bytes -> 43 base64url characters.
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('does not repeat tokens across generations', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 500; i += 1) {
      tokens.add(generateSessionToken());
    }
    expect(tokens.size).toBe(500);
  });

  it('hashes tokens deterministically for storage', () => {
    const token = generateSessionToken();
    const hashA = hashSessionToken(token);
    const hashB = hashSessionToken(token);
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different hashes for different tokens', () => {
    const a = hashSessionToken(generateSessionToken());
    const b = hashSessionToken(generateSessionToken());
    expect(a).not.toBe(b);
  });

  it('the raw token never appears in its stored hash', () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    expect(hash.includes(token)).toBe(false);
  });
});

describe('safeEqual', () => {
  it('matches equal strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
  });

  it('rejects different strings', () => {
    expect(safeEqual('abc', 'abd')).toBe(false);
  });

  it('rejects different lengths without throwing', () => {
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('', 'x')).toBe(false);
  });
});
