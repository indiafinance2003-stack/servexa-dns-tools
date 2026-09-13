import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Session tokens are 256-bit cryptographically secure random values rendered
 * as URL-safe strings. Only a SHA-256 hash of the token is persisted, so a
 * database leak does not expose usable credentials.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) {
    // Compare against self to keep timing constant, then fail.
    timingSafeEqual(bufferA, bufferA);
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}
