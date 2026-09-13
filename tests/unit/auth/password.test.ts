import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, passwordSchema } from '@/lib/auth/password';

describe('Argon2id password hashing', () => {
  it('round-trips a valid password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).toContain('$argon2id$');
    const verified = await verifyPassword(hash, 'correct horse battery staple');
    expect(verified).toBe(true);
  });

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    const verified = await verifyPassword(hash, 'wrong password');
    expect(verified).toBe(false);
  });

  it('produces different hashes for the same password (unique salts)', async () => {
    const a = await hashPassword('same-password-123');
    const b = await hashPassword('same-password-123');
    expect(a).not.toBe(b);
  });

  it('returns false (not a throw) for malformed stored hashes', async () => {
    const verified = await verifyPassword('not-a-valid-hash', 'anything');
    expect(verified).toBe(false);
  });
});

describe('password policy', () => {
  it('accepts a reasonable passphrase', () => {
    const result = passwordSchema.safeParse('correct horse battery staple');
    expect(result.success).toBe(true);
  });

  it('requires the minimum length', () => {
    const result = passwordSchema.safeParse('short9');
    expect(result.success).toBe(false);
  });

  it('accepts exactly 10 characters', () => {
    expect(passwordSchema.safeParse('0123456789').success).toBe(true);
  });

  it('enforces the maximum length to prevent abuse', () => {
    const longPassword = 'x'.repeat(201);
    expect(passwordSchema.safeParse(longPassword).success).toBe(false);
    expect(passwordSchema.safeParse('x'.repeat(200)).success).toBe(true);
  });

  it('rejects control characters', () => {
    expect(passwordSchema.safeParse('password\u0000test').success).toBe(false);
    expect(passwordSchema.safeParse('password\ntest').success).toBe(false);
  });

  it('does not trim passwords (passwords are used verbatim)', () => {
    // A password with surrounding spaces is valid as-is; trimming would
    // silently alter the user's credential.
    const result = passwordSchema.safeParse('  spaced secret  ');
    expect(result.success).toBe(true);
  });
});
