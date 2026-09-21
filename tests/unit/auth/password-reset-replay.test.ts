import { describe, expect, it, vi } from 'vitest';
import { completePasswordReset, requestPasswordReset } from '@/lib/auth/password-reset';
import { hashPasswordResetToken } from '@/lib/auth/tokens';
import { PASSWORD_RESET_TOKEN_TTL_MS } from '@/lib/auth/password-reset';
import { verifyPassword } from '@/lib/auth/password';
import { logger } from '@/lib/logging/logger';
import { createMemPasswordResetStore, tokenFromResetUrl } from './password-reset-store';
import { ACTIVE_USER, issueToken } from './password-reset-expiry.test';

vi.mock('@/lib/email/transactional', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/transactional')>();
  return { ...actual, sendPasswordResetEmail: vi.fn(async () => {}) };
});

describe('single-use and replay protection', () => {
  it('first valid reset succeeds and second use fails', async () => {
    const store = createMemPasswordResetStore([ACTIVE_USER]);
    const token = await issueToken(store);
    await completePasswordReset(
      { token, password: 'a brand new passphrase' },
      { repository: store.repository }
    );
    await expect(
      completePasswordReset(
        { token, password: 'another valid passphrase' },
        { repository: store.repository }
      )
    ).rejects.toMatchObject({ code: 'PASSWORD_RESET_INVALID' });
    expect(store.tokens.filter((t) => t.usedAt === null)).toHaveLength(0);
    const user = store.users.get(ACTIVE_USER.id);
    expect(await verifyPassword(user?.passwordHash ?? '', 'a brand new passphrase')).toBe(true);
  });

  it('repeated consumption attempts cannot reset twice', async () => {
    const store = createMemPasswordResetStore([ACTIVE_USER]);
    const token = await issueToken(store);
    await completePasswordReset(
      { token, password: 'first concurrent passphrase' },
      { repository: store.repository }
    );
    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        completePasswordReset(
          { token, password: 'racing passphrase attempt' },
          { repository: store.repository }
        )
      )
    );
    expect(attempts.every((a) => a.status === 'rejected')).toBe(true);
  });
});

describe('account state and password handling', () => {
  it('inactive users cannot complete a reset and are not reactivated', async () => {
    const suspended = createMemPasswordResetStore([{ ...ACTIVE_USER, status: 'suspended' }]);
    const raw = 'suspended-account-token-0123456789ab';
    await suspended.repository.createToken({
      userId: ACTIVE_USER.id,
      tokenHash: hashPasswordResetToken(raw),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
    });
    await expect(
      completePasswordReset(
        { token: raw, password: 'a brand new passphrase' },
        { repository: suspended.repository }
      )
    ).rejects.toMatchObject({ code: 'PASSWORD_RESET_INVALID' });
    expect(suspended.users.get(ACTIVE_USER.id)?.status).toBe('suspended');
  });

  it('valid password is Argon2 hashed and never logged', async () => {
    const store = createMemPasswordResetStore([ACTIVE_USER]);
    const token = await issueToken(store);
    const password = 'correct horse battery staple';
    const seen: string[] = [];
    const spies = (['debug', 'info', 'warn', 'error'] as const).map((level) =>
      vi.spyOn(logger, level).mockImplementation(((message: string, data?: unknown) => {
        seen.push(JSON.stringify({ message, data }));
      }) as never)
    );
    try {
      await completePasswordReset({ token, password }, { repository: store.repository });
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
    const stored = store.users.get(ACTIVE_USER.id)?.passwordHash ?? '';
    expect(stored).not.toContain(password);
    expect(stored).toContain('$argon2id$');
    expect(await verifyPassword(stored, password)).toBe(true);
    for (const entry of seen) {
      expect(entry.includes(token)).toBe(false);
      expect(entry.includes(password)).toBe(false);
    }
  });
});

describe('session invalidation on reset', () => {
  it('deletes every session of the user while leaving others untouched', async () => {
    const other = {
      id: 'user-other-1',
      name: 'Other User',
      email: 'other@example.com',
      status: 'active',
      passwordHash: 'argon2:other',
    };
    const store = createMemPasswordResetStore([ACTIVE_USER, other]);
    store.addSession(ACTIVE_USER.id);
    store.addSession(ACTIVE_USER.id);
    const otherSession = store.addSession(other.id);
    let resetUrl = '';
    await requestPasswordReset(ACTIVE_USER.email, {
      repository: store.repository,
      sendEmail: vi.fn(async (input: { resetUrl: string }) => {
        resetUrl = input.resetUrl;
      }),
    });
    const token = tokenFromResetUrl(resetUrl);
    await completePasswordReset(
      { token, password: 'a brand new passphrase' },
      { repository: store.repository }
    );
    expect(store.sessionsFor(ACTIVE_USER.id)).toHaveLength(0);
    expect(store.sessionsFor(other.id)).toEqual([otherSession]);
  });

  it('does not create a session on reset (no automatic login)', async () => {
    const store = createMemPasswordResetStore([ACTIVE_USER]);
    const token = await issueToken(store);
    await completePasswordReset(
      { token, password: 'a brand new passphrase' },
      { repository: store.repository }
    );
    expect(store.sessionsFor(ACTIVE_USER.id)).toHaveLength(0);
  });
});
