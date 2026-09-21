import { describe, expect, it, vi } from 'vitest';
import { forgotPasswordSchema, resetPasswordSchema } from '@/lib/auth/schemas';
import { passwordSchema } from '@/lib/auth/password';

vi.mock('@/lib/email/transactional', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/transactional')>();
  return { ...actual, sendPasswordResetEmail: vi.fn(async () => {}) };
});

describe('password validation at the reset boundary', () => {
  it('enforces the existing password schema rules', () => {
    expect(passwordSchema.safeParse('short').success).toBe(false);
    expect(passwordSchema.safeParse('x'.repeat(201)).success).toBe(false);
    expect(passwordSchema.safeParse('password\ntest12').success).toBe(false);
    expect(passwordSchema.safeParse('correct horse battery staple').success).toBe(true);
  });

  it('rejects weak/invalid passwords in the reset schema', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'sometoken',
      password: 'short',
      confirmPassword: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects confirmation mismatch at the schema boundary', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'sometoken',
      password: 'correct horse battery staple',
      confirmPassword: 'different passphrase value',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message)).toContain('Passwords do not match');
    }
  });

  it('accepts a valid token/password/confirmation triple', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      password: 'correct horse battery staple',
      confirmPassword: 'correct horse battery staple',
    });
    expect(result.success).toBe(true);
  });

  it('forgot-password accepts only an email field', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'User@Example.com' }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
    const parsed = forgotPasswordSchema.safeParse({ email: 'User@Example.com' });
    if (parsed.success) expect(parsed.data.email).toBe('user@example.com');
  });
});
