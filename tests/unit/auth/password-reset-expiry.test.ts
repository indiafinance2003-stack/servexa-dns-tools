import { describe, expect, it, vi } from 'vitest';
import {
  completePasswordReset,
  PASSWORD_RESET_TOKEN_TTL_MS,
  requestPasswordReset,
} from '@/lib/auth/password-reset';
import { AppError, AppErrorCode } from '@/lib/errors/app-error';
import { createMemPasswordResetStore, tokenFromResetUrl } from './password-reset-store';

vi.mock('@/lib/email/transactional', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/transactional')>();
  return { ...actual, sendPasswordResetEmail: vi.fn(async () => {}) };
});

export const ACTIVE_USER = {
  id: 'user-active-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  status: 'active',
  passwordHash: 'argon2:old-hash',
};

export async function issueToken(
  store: ReturnType<typeof createMemPasswordResetStore>,
  now?: () => Date
): Promise<string> {
  let resetUrl = '';
  await requestPasswordReset(ACTIVE_USER.email, {
    repository: store.repository,
    ...(now ? { now } : {}),
    sendEmail: vi.fn(async (input: { resetUrl: string }) => {
      resetUrl = input.resetUrl;
    }),
  });
  return tokenFromResetUrl(resetUrl);
}

describe('reset token expiry', () => {
  it('a valid token succeeds before expiration', async () => {
    const store = createMemPasswordResetStore([ACTIVE_USER]);
    const token = await issueToken(store);
    const result = await completePasswordReset(
      { token, password: 'a brand new passphrase' },
      { repository: store.repository }
    );
    expect(result).toEqual({ completed: true });
  });

  it('a token exactly at expiration is rejected (server time)', async () => {
    const store = createMemPasswordResetStore([ACTIVE_USER]);
    const issuedAt = new Date('2026-09-21T12:00:00.000Z');
    const token = await issueToken(store, () => issuedAt);
    const expiresAt = store.created[0].expiresAt;
    await expect(
      completePasswordReset(
        { token, password: 'a brand new passphrase' },
        { repository: store.repository, now: () => expiresAt }
      )
    ).rejects.toMatchObject({ code: AppErrorCode.PASSWORD_RESET_INVALID });
  });

  it('an expired token is rejected and leaves the password untouched', async () => {
    const store = createMemPasswordResetStore([ACTIVE_USER]);
    const issuedAt = new Date('2026-09-21T12:00:00.000Z');
    const token = await issueToken(store, () => issuedAt);
    const afterExpiry = new Date(issuedAt.getTime() + PASSWORD_RESET_TOKEN_TTL_MS + 1_000);
    await expect(
      completePasswordReset(
        { token, password: 'a brand new passphrase' },
        { repository: store.repository, now: () => afterExpiry }
      )
    ).rejects.toMatchObject({ code: AppErrorCode.PASSWORD_RESET_INVALID });
    expect(store.users.get(ACTIVE_USER.id)?.passwordHash).toBe('argon2:old-hash');
  });

  it('an unknown token is rejected with the generic error', async () => {
    const store = createMemPasswordResetStore([ACTIVE_USER]);
    const error = await completePasswordReset(
      { token: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', password: 'a brand new passphrase' },
      { repository: store.repository }
    ).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(AppErrorCode.PASSWORD_RESET_INVALID);
  });
});
