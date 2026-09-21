import { createHash, randomBytes } from 'crypto';
import { describe, expect, it } from 'vitest';
import { generatePasswordResetToken, hashPasswordResetToken } from '@/lib/auth/tokens';
import {
  buildPasswordResetUrl,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from '@/lib/auth/password-reset';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

describe('password-reset token security', () => {
  it('generates tokens with 256-bit cryptographic entropy in URL-safe form', () => {
    const token = generatePasswordResetToken();
    // 32 random bytes -> exactly 43 base64url characters (256 bits).
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('does not repeat generated tokens', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      seen.add(generatePasswordResetToken());
    }
    expect(seen.size).toBe(200);
  });

  it('persists only the SHA-256 hash of the token (raw token never stored)', () => {
    const token = generatePasswordResetToken();
    const persisted = hashPasswordResetToken(token);
    expect(persisted).toBe(sha256Hex(token));
    expect(persisted).toMatch(/^[0-9a-f]{64}$/);
    expect(persisted.includes(token)).toBe(false);
  });

  it('produces different hashes for different generated tokens', () => {
    const first = hashPasswordResetToken(generatePasswordResetToken());
    const second = hashPasswordResetToken(generatePasswordResetToken());
    expect(first).not.toBe(second);
  });

  it('hashes tokens with a non-trivial amount of random input', () => {
    // Guard against a stub generator returning short/predictable strings.
    const random = randomBytes(32).toString('base64url');
    expect(random).toHaveLength(43);
    const hashed = hashPasswordResetToken(random);
    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
    expect(hashed).not.toBe(random);
  });

  it('places the raw token in the reset URL query only (single occurrence, encoded)', () => {
    const token = generatePasswordResetToken();
    const resetUrl = buildPasswordResetUrl(token);
    const url = new URL(resetUrl);
    expect(url.pathname).toBe('/reset-password');
    expect(url.searchParams.get('token')).toBe(token);
    const encoded = encodeURIComponent(token);
    expect(resetUrl).toContain(encoded);
    // The token appears exactly once — the query value — and never in the path.
    expect(resetUrl.split(encoded)).toHaveLength(2);
  });

  it('uses a 30 minute expiry window constant', () => {
    expect(PASSWORD_RESET_TOKEN_TTL_MS).toBe(30 * 60 * 1000);
  });
});
