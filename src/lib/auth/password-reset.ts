import 'server-only';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { getDatabase } from '@/lib/db';
import {
  passwordResetTokens,
  sessions,
  users,
} from '@/lib/db/schema';
import { generatePasswordResetToken, hashPasswordResetToken } from './tokens';
import { hashPassword } from './password';
import { config } from '@/lib/config';
import { AppError, AppErrorCode } from '@/lib/errors/app-error';
import {
  describeEmailDeliveryIssue,
  emailProviderStatus,
  sendPasswordResetEmail,
  type PasswordResetEmailInput,
} from '@/lib/email/transactional';
import { logger } from '@/lib/logging/logger';

/**
 * Password reset orchestration.
 *
 * Security properties enforced here:
 * - Reset tokens are 256-bit cryptographically secure random values; only their
 *   SHA-256 hash is ever persisted. The raw token exists only in server memory,
 *   the reset URL, and the emitted reset email — it is never logged.
 * - Tokens expire server-side after 30 minutes.
 * - Tokens are single use. Consumption is an atomic conditional UPDATE inside a
 *   transaction (token marked used + password updated + sessions deleted
 *   together), so two racing requests can never both succeed.
 * - The forgot-password public response never reveals whether an account
 *   exists; email delivery is never pretended.
 */

export const PASSWORD_RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
export const PASSWORD_RESET_EXPIRES_IN_MINUTES = 30;

/** A user eligible to receive a reset link (exists and active). */
export interface PasswordResetUser {
  id: string;
  name: string;
}

export type ResetConsumptionResult =
  | { outcome: 'success'; userId: string }
  | { outcome: 'invalid' }
  | { outcome: 'user_inactive' };

/**
 * Storage boundary for password-reset state. The production implementation is
 * `drizzlePasswordResetRepository()`; an in-memory implementation can be
 * injected for unit tests. Nothing here depends on a transport, limiter, or
 * email provider.
 */
export interface PasswordResetRepository {
  findUserByEmail(email: string): Promise<PasswordResetUser | null>;
  deleteUnusedTokens(userId: string): Promise<void>;
  createToken(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  /**
   * Atomically consumes the token and, when valid, resets the password and
   * deletes every session for the user. Returns 'invalid' for unknown, expired
   * or already-used tokens (the token row is also a single-use guard against
   * replay), and 'user_inactive' when the owner is not active.
   */
  consumeTokenAndReset(input: {
    tokenHash: string;
    now: Date;
    newPasswordHash: string;
  }): Promise<ResetConsumptionResult>;
}

export function drizzlePasswordResetRepository(): PasswordResetRepository {
  return {
    async findUserByEmail(email) {
      const { db } = getDatabase();
      const rows = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(and(eq(users.email, email), eq(users.status, 'active')))
        .limit(1);
      return rows[0] ?? null;
    },

    async deleteUnusedTokens(userId) {
      const { db } = getDatabase();
      await db
        .delete(passwordResetTokens)
        .where(
          and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt))
        );
    },

    async createToken({ userId, tokenHash, expiresAt }) {
      const { db } = getDatabase();
      await db.insert(passwordResetTokens).values({ userId, tokenHash, expiresAt });
    },

    async consumeTokenAndReset({ tokenHash, now, newPasswordHash }) {
      const { db } = getDatabase();
      return db.transaction(async (tx) => {
        // 1. Look up the candidate token without consuming it yet. Expiry uses
        //    the injected server `now` — never any client-supplied time.
        const candidates = await tx
          .select({ tokenId: passwordResetTokens.id, userId: passwordResetTokens.userId })
          .from(passwordResetTokens)
          .where(
            and(
              eq(passwordResetTokens.tokenHash, tokenHash),
              isNull(passwordResetTokens.usedAt),
              gt(passwordResetTokens.expiresAt, now)
            )
          )
          .limit(1);

        if (candidates.length === 0) return { outcome: 'invalid' } as const;

        const userId = candidates[0].userId;

        // 2. The account must still exist and be active. This check runs BEFORE
        //    the token is consumed so an inactive/deleted account never burns a
        //    token without changing the password.
        const found = await tx
          .select({ status: users.status })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!found[0] || found[0].status !== 'active') {
          return { outcome: 'user_inactive' } as const;
        }

        // 3. Atomic single-use consumption: `used_at IS NULL` plus the expiry
        //    guard in the conditional UPDATE means the first transaction to
        //    reach this row wins and every concurrent request for the same
        //    token sees zero affected rows. Because everything runs inside one
        //    transaction, a later failure (password update / session delete)
        //    rolls the consumption back as well.
        const consumed = await tx
          .update(passwordResetTokens)
          .set({ usedAt: now })
          .where(
            and(
              eq(passwordResetTokens.id, candidates[0].tokenId),
              isNull(passwordResetTokens.usedAt),
              gt(passwordResetTokens.expiresAt, now)
            )
          )
          .returning({ tokenId: passwordResetTokens.id, userId: passwordResetTokens.userId });

        if (consumed.length === 0) return { outcome: 'invalid' } as const;

        await tx
          .update(users)
          .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
          .where(eq(users.id, userId));

        await tx.delete(sessions).where(eq(sessions.userId, userId));

        return { outcome: 'success', userId } as const;
      });
    },
  };
}

/**
 * Builds the password-reset URL from the trusted server APP_URL setting.
 * APP_URL is deployment configuration, never user input. The raw token is
 * embedded here (and only here, plus the email) — this URL must never be
 * logged, stored, or sent anywhere except the user's inbox.
 */
export function buildPasswordResetUrl(token: string): string {
  const base = config.APP_URL.replace(/\/+$/, '');
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

export interface RequestPasswordResetOptions {
  repository?: PasswordResetRepository;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
  /**
   * Injectable sender; defaults to the provider-neutral sendPasswordResetEmail.
   * When explicitly injected (unit tests), it is invoked directly so delivery
   * behavior can be observed without email configuration.
   */
  sendEmail?: (input: PasswordResetEmailInput) => Promise<void>;
}

/**
 * Handles a forgot-password request for one (already normalized) email.
 *
 * Always returns without distinguishing known vs unknown accounts, so the API
 * route can answer generically. When the account exists, previous unused tokens
 * are invalidated and a fresh 30-minute token is persisted (hash only) before
 * delivery is attempted.
 */
export async function requestPasswordReset(
  email: string,
  options: RequestPasswordResetOptions = {}
): Promise<{ resetRequested: boolean }> {
  const repository = options.repository ?? drizzlePasswordResetRepository();
  const now = options.now ?? (() => new Date());
  const sendEmail = options.sendEmail ?? sendPasswordResetEmail;

  const user = await repository.findUserByEmail(email);
  if (!user) {
    // No account (or not active): nothing to do. The caller still returns the
    // exact same public response as a successful request.
    return { resetRequested: false };
  }

  const token = generatePasswordResetToken();
  const expiresAt = new Date(now().getTime() + PASSWORD_RESET_TOKEN_TTL_MS);

  await repository.deleteUnusedTokens(user.id);
  await repository.createToken({
    userId: user.id,
    tokenHash: hashPasswordResetToken(token),
    expiresAt,
  });

  const resetUrl = buildPasswordResetUrl(token);

  // An explicitly injected sender (unit tests) is invoked directly so delivery
  // behavior is observable without email configuration. The default production
  // sender first checks configuration so an empty/unsupported EMAIL_PROVIDER
  // never pretends an email was sent.
  if (options.sendEmail) {
    try {
      await options.sendEmail({
        to: email,
        recipientName: user.name,
        resetUrl,
        expiresInMinutes: PASSWORD_RESET_EXPIRES_IN_MINUTES,
      });
      logger.info('Password reset email delivered', { userId: user.id });
    } catch (error) {
      logger.error('Password reset email delivery failed', {
        userId: user.id,
        reason: describeEmailDeliveryIssue(error),
      });
    }
    return { resetRequested: true };
  }

  // Delivery is checked BEFORE invocation so the log is honest: an empty or
  // unsupported EMAIL_PROVIDER is an operator-configuration problem, reported
  // in the log with no secrets and no token. The public response never changes.
  const delivery = emailProviderStatus();
  if (!delivery.configured) {
    logger.warn('Password reset email delivery unavailable', {
      userId: user.id,
      provider: delivery.configuredProvider ?? null,
    });
    return { resetRequested: true };
  }

  try {
    await sendEmail({
      to: email,
      recipientName: user.name,
      resetUrl,
      expiresInMinutes: PASSWORD_RESET_EXPIRES_IN_MINUTES,
    });
    logger.info('Password reset email delivered', { userId: user.id });
  } catch (error) {
    // Sanitized: never credentials, never the reset token or URL.
    logger.error('Password reset email delivery failed', {
      userId: user.id,
      reason: describeEmailDeliveryIssue(error),
    });
  }

  return { resetRequested: true };
}

export interface CompletePasswordResetOptions {
  repository?: PasswordResetRepository;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
}

/**
 * Completes a password reset from the raw token and the new password.
 *
 * Throws AppError(PASSWORD_RESET_INVALID) for unknown, expired, or already-used
 * tokens and for accounts that no longer exist or are no longer active — a
 * single generic message that never reveals which condition occurred. On
 * success the password hash is replaced and every session for the user is
 * deleted atomically.
 */
export async function completePasswordReset(
  input: { token: string; password: string },
  options: CompletePasswordResetOptions = {}
): Promise<{ completed: boolean }> {
  const repository = options.repository ?? drizzlePasswordResetRepository();
  const now = options.now ?? (() => new Date());

  const tokenHash = hashPasswordResetToken(input.token);
  const newPasswordHash = await hashPassword(input.password);

  const result = await repository.consumeTokenAndReset({
    tokenHash,
    newPasswordHash,
    now: now(),
  });

  if (result.outcome !== 'success') {
    throw new AppError(
      AppErrorCode.PASSWORD_RESET_INVALID,
      'This password reset link is invalid or has expired.'
    );
  }

  logger.info('Password reset completed', { userId: result.userId });
  return { completed: true };
}