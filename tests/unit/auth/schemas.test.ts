import { describe, expect, it } from 'vitest';
import { emailSchema, loginSchema, nameSchema, normalizeEmail, registrationSchema } from '@/lib/auth/schemas';

describe('email normalization', () => {
  it('lowercases and trims consistently', () => {
    expect(normalizeEmail('  User@EXAMPLE.com ')).toBe('user@example.com');
  });

  it('is idempotent', () => {
    const once = normalizeEmail('Mixed@Case.COM');
    expect(normalizeEmail(once)).toBe(once);
  });
});

describe('emailSchema', () => {
  it('accepts valid addresses and normalizes them', () => {
    const result = emailSchema.safeParse('User@Example.COM');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('user@example.com');
  });

  it('rejects addresses without a dot in the domain', () => {
    expect(emailSchema.safeParse('user@localhost').success).toBe(false);
  });

  it('rejects whitespace inside the address', () => {
    expect(emailSchema.safeParse('user name@example.com').success).toBe(false);
  });

  it('enforces a maximum length', () => {
    const local = 'a'.repeat(250);
    expect(emailSchema.safeParse(`${local}@example.com`).success).toBe(false);
  });
});

describe('nameSchema', () => {
  it('trims surrounding whitespace', () => {
    const result = nameSchema.safeParse('  Jane Doe  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('Jane Doe');
  });

  it('rejects empty names', () => {
    expect(nameSchema.safeParse('   ').success).toBe(false);
  });

  it('enforces a maximum length', () => {
    expect(nameSchema.safeParse('x'.repeat(81)).success).toBe(false);
  });
});

describe('registrationSchema', () => {
  const valid = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    password: 'correct horse battery',
    confirmPassword: 'correct horse battery',
  };

  it('accepts a complete valid registration', () => {
    const result = registrationSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('jane@example.com');
  });

  it('rejects mismatched password confirmation', () => {
    const result = registrationSchema.safeParse({ ...valid, confirmPassword: 'different' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain('Passwords do not match');
    }
  });

  it('rejects short passwords with a clear message', () => {
    const result = registrationSchema.safeParse({ ...valid, password: 'short', confirmPassword: 'short' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain('Password must be at least 10 characters');
    }
  });

  it('rejects invalid emails', () => {
    expect(registrationSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects missing names', () => {
    expect(registrationSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid credentials and normalizes the email', () => {
    const result = loginSchema.safeParse({ email: 'User@Example.com', password: 'whatever' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('user@example.com');
  });

  it('rejects empty passwords', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com', password: '' }).success).toBe(false);
  });

  it('rejects oversized passwords', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com', password: 'x'.repeat(201) }).success).toBe(false);
  });
});
