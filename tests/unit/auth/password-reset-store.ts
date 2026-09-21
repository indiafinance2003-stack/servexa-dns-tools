import type {
  PasswordResetRepository,
  ResetConsumptionResult,
} from '@/lib/auth/password-reset';

export interface MemUser {
  id: string;
  name: string;
  email: string;
  status: string;
  passwordHash: string;
}

interface MemTokenRow {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

/**
 * In-memory PasswordResetRepository mirror used by unit tests. It replicates
 * the production Drizzle semantics that matter for security tests:
 * - findUserByEmail only matches active accounts (enumeration-safe lookup)
 * - deleteUnusedTokens removes prior unused tokens for the user
 * - consumeTokenAndReset checks validity, then account status, then consumes
 *   with a conditional re-check (single-use guard) before updating the
 *   password hash and deleting that user's sessions — without touching other
 *   users' sessions.
 */
export function createMemPasswordResetStore(initialUsers: MemUser[] = []) {
  const users = new Map<string, MemUser>(initialUsers.map((u) => [u.id, { ...u }]));
  const tokens: MemTokenRow[] = [];
  const sessions = new Map<string, Set<string>>();
  let sessionSeq = 0;
  const created: Array<{ userId: string; tokenHash: string; expiresAt: Date }> = [];
  const deletedUnusedCalls: string[] = [];

  const repository: PasswordResetRepository = {
    async findUserByEmail(email: string) {
      for (const user of users.values()) {
        if (user.email === email && user.status === 'active') {
          return { id: user.id, name: user.name };
        }
      }
      return null;
    },

    async deleteUnusedTokens(userId: string) {
      deletedUnusedCalls.push(userId);
      for (let i = tokens.length - 1; i >= 0; i -= 1) {
        if (tokens[i].userId === userId && tokens[i].usedAt === null) {
          tokens.splice(i, 1);
        }
      }
    },

    async createToken(input: { userId: string; tokenHash: string; expiresAt: Date }) {
      created.push({ ...input });
      tokens.push({
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        usedAt: null,
      });
    },

    async consumeTokenAndReset(input: {
      tokenHash: string;
      now: Date;
      newPasswordHash: string;
    }): Promise<ResetConsumptionResult> {
      const candidate = tokens.find(
        (t) =>
          t.tokenHash === input.tokenHash &&
          t.usedAt === null &&
          t.expiresAt.getTime() > input.now.getTime()
      );
      if (!candidate) return { outcome: 'invalid' };

      // Account check runs BEFORE consumption so inactive/deleted accounts
      // never burn a token without changing the password.
      const user = users.get(candidate.userId);
      if (!user || user.status !== 'active') return { outcome: 'user_inactive' };

      // Conditional single-use guard: re-verify unused + unexpired immediately
      // before marking used, so a racing second consumer loses.
      const stillValid =
        candidate.usedAt === null && candidate.expiresAt.getTime() > input.now.getTime();
      if (!stillValid) return { outcome: 'invalid' };

      candidate.usedAt = input.now;
      user.passwordHash = input.newPasswordHash;
      sessions.set(candidate.userId, new Set());
      return { outcome: 'success', userId: candidate.userId };
    },
  };

  return {
    users,
    tokens,
    sessions,
    created,
    deletedUnusedCalls,
    repository,
    addSession(userId: string): string {
      const id = `sess-${++sessionSeq}`;
      if (!sessions.has(userId)) sessions.set(userId, new Set());
      sessions.get(userId)?.add(id);
      return id;
    },
    sessionsFor(userId: string): string[] {
      return [...(sessions.get(userId) ?? [])];
    },
  };
}

export type MemPasswordResetStore = ReturnType<typeof createMemPasswordResetStore>;

/** Raw reset token is carried only in the `token` query parameter. */
export function tokenFromResetUrl(resetUrl: string): string {
  const token = new URL(resetUrl).searchParams.get('token');
  if (!token) throw new Error('reset URL did not contain a token query parameter');
  return token;
}
