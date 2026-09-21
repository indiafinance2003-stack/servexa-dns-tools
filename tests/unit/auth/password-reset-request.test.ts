import { createHash } from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PASSWORD_RESET_TOKEN_TTL_MS,
  requestPasswordReset,
} from '@/lib/auth/password-reset';
import { logger } from '@/lib/logging/logger';
import { createMemPasswordResetStore, tokenFromResetUrl } from './password-reset-store';

// The transactional sender is injected per call in these tests, so stub the
// module default only to guarantee no real delivery can occur silently.
vi.mock('@/lib/email/transactional', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email/transactional')>();
  return {
    ...actual,
    sendPasswordResetEmail: vi.fn(async () => {}),
  };
});

const ACTIVE_USER = {
  id: 'user-active-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  status: 'active',
  passwordHash: 'argon2:old-hash',
};

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function makeSendEmail() {
  return vi.fn(
    async (_input: {
      to: string;
      recipientName: string;
      resetUrl: string;
      expiresInMinutes: number;
    }) => {}
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('forgot-password enumeration protection', () => {
  it('inactive accounts produce the same internal result as unknown accounts', async () => {
    const unknown = createMemPasswordResetStore([ACTIVE_USER]);
    const inactive = createMemPasswordResetStore([{ ...ACTIVE_USER, status: 'suspended' }]);
    const sendUnknown = makeSendEmail();
    const sendInactive = makeSendEmail();

    const unknownResult = await requestPasswordReset('missing@example.com', {
      repository: unknown.repository,
      sendEmail: sendUnknown,
    });
    const inactiveResult = await requestPasswordReset(ACTIVE_USER.email, {
      repository: inactive.repository,
      sendEmail: sendInactive,
    });

    expect(inactiveResult).toEqual(unknownResult);
    expect(sendUnknown).not.toHaveBeenCalled();
    expect(sendInactive).not.toHaveBeenCalled();
    expect(unknown.created).toHaveLength(0);
    expect(inactive.created).toHaveLength(0);
  });

  it('unknown email never creates a token and never calls the email sender', async () => {
    const store = createMemPasswordResetStore([ACTIVE_USER]);
    const sendEmail = makeSendEmail();
    const result = await requestPasswordReset('nobody@example.com', {
      repository: store.repository,
      sendEmail,
    });
    expect(result).toEqual({ resetRequested: false });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(store.created).toHaveLength(0);
    expect(store.deletedUnusedCalls).toHaveLength(0);
  });

  it('known account invalidates previous unused tokens before creating a new one', async () => {
    const store = createMemPasswordResetStore([ACTIVE_USER]);
    const sendEmail = makeSendEmail();
    const result = await requestPasswordReset(ACTIVE_USER.email, {
      repository: store.repository,
      sendEmail,
    });
    expect(result).toEqual({ resetRequested: true });
    expect(store.deletedUnusedCalls).toEqual([ACTIVE_USER.id]);
    expect(store.created).toHaveLength(1);
    const created = store.created[0];
    expect(created.userId).toBe(ACTIVE_USER.id);
    expect(created.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('no raw token is persisted and expiry is exactly 30 minutes from server time', async () => {
    const store = createMemPasswordResetStore([ACTIVE_USER]);
    const frozen = new Date('2026-09-21T12:00:00.000Z');
    let capturedResetUrl = '';
    const capturingSend = vi.fn(async (input: { resetUrl: string }) => {
      capturedResetUrl = input.resetUrl;
    });

    await requestPasswordReset(ACTIVE_USER.email, {
      repository: store.repository,
      now: () => frozen,
      sendEmail: capturingSend,
    });

    expect(store.created).toHaveLength(1);
    const created = store.created[0];
    expect(created.expiresAt.getTime()).toBe(frozen.getTime() + PASSWORD_RESET_TOKEN_TTL_MS);

    const rawToken = tokenFromResetUrl(capturedResetUrl);
    expect(created.tokenHash).toBe(sha256Hex(rawToken));
    expect(created.tokenHash.includes(rawToken)).toBe(false);
    expect(JSON.stringify(store.tokens).includes(rawToken)).toBe(false);
  });

  it('never logs the raw token or reset URL', async () => {
    const store = createMemPasswordResetStore([ACTIVE_USER]);
    const seen: string[] = [];
    const spies = (['debug', 'info', 'warn', 'error'] as const).map((level) =>
      vi.spyOn(logger, level).mockImplementation(((message: string, data?: unknown) => {
        seen.push(JSON.stringify({ message, data }));
      }) as never)
    );
    let capturedResetUrl = '';
    try {
      await requestPasswordReset(ACTIVE_USER.email, {
        repository: store.repository,
        sendEmail: vi.fn(async (input: { resetUrl: string }) => {
          capturedResetUrl = input.resetUrl;
        }),
      });
      const rawToken = tokenFromResetUrl(capturedResetUrl);
      for (const entry of seen) {
        expect(entry.includes(rawToken)).toBe(false);
        expect(entry.includes(encodeURIComponent(rawToken))).toBe(false);
        expect(entry.includes('reset-password?token=')).toBe(false);
      }
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });
});
