import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/email/transactional', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/transactional')>();
  return { ...actual, sendPasswordResetEmail: vi.fn(async () => {}) };
});

function readSource(...parts: string[]): string {
  return readFileSync(join(process.cwd(), ...parts), 'utf8');
}

describe('password-reset surface (routes, pages, and client rules)', () => {
  it('login page links to forgot-password with the exact label', () => {
    const source = readSource('src', 'app', 'login', 'page.tsx');
    expect(source).toContain('href="/forgot-password"');
    expect(source).toContain('Forgot password?');
  });

  it('forgot-password and reset-password pages are noindex/nofollow', () => {
    const forgot = readSource('src', 'app', 'forgot-password', 'page.tsx');
    const reset = readSource('src', 'app', 'reset-password', 'page.tsx');
    for (const source of [forgot, reset]) {
      expect(source).toContain('index: false');
      expect(source).toContain('follow: false');
    }
  });

  it('forgot-password route returns a generic message with no token', () => {
    const source = readSource('src', 'app', 'api', 'auth', 'forgot-password', 'route.ts');
    expect(source).toContain('If an account exists for that email');
    expect(source.toLowerCase()).not.toContain('token');
    // Both limiters are consulted: per email+client and per client.
    expect(source).toContain('getForgotPasswordRateLimiter');
    expect(source).toContain('getForgotPasswordClientRateLimiter');
  });

  it('reset-password route returns a sign-in message without leaking state', () => {
    const source = readSource('src', 'app', 'api', 'auth', 'reset-password', 'route.ts');
    expect(source).toContain('Please sign in with your new password');
    // Success response must not mint a session/cookie: reset never logs in.
    expect(source).not.toMatch(/createSession|SESSION_COOKIE|cookies\(\)/);
    // The API response body is only the generic message — no token echoed.
    expect(source).not.toMatch(/return\s*\{\s*token/);
    expect(source).not.toMatch(/resetRequested/);
  });

  it('reset page reads the token from the URL and shows invalid/expired + sign-in states', () => {
    const page = readSource('src', 'app', 'reset-password', 'page.tsx');
    const form = readSource('src', 'components', 'auth', 'reset-password-form.tsx');
    expect(page).toContain('searchParams');
    expect(page).toContain('token');
    expect(page).toContain('invalid or has expired');
    expect(form).toContain('/api/auth/reset-password');
    expect(form).toContain('Sign in');
    expect(form).toContain('confirmPassword');
    expect(form).toContain('role="status"');
    expect(form).toContain('role="alert"');
  });
});
