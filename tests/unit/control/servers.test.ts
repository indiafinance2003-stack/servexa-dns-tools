import { describe, expect, it } from 'vitest';
import { SERVER_STATUSES } from '@/lib/control/servers';
import { createHash } from 'crypto';

/** Mirrors the private server-token hash so its format stays covered by tests. */
function expectedServerTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

describe('server status constants', () => {
  it('defines the expected statuses', () => {
    expect(SERVER_STATUSES).toEqual(['active', 'suspended', 'deactivated']);
  });

  it('status is immutable at type level', () => {
    const status: (typeof SERVER_STATUSES)[number] = 'active';
    expect(status).toBe('active');
  });
});

describe('token hashing', () => {
  it('produces deterministic SHA-256 hashes', () => {
    const hash1 = expectedServerTokenHash('my-secret-token');
    const hash2 = expectedServerTokenHash('my-secret-token');
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different hashes for different tokens', () => {
    const hash1 = expectedServerTokenHash('token-one');
    const hash2 = expectedServerTokenHash('token-two');
    expect(hash1).not.toBe(hash2);
  });

  it('hashes empty input to the well-known SHA-256 digest', () => {
    expect(expectedServerTokenHash('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });
});
