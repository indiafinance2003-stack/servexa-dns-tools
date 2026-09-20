import 'server-only';
import crypto from 'crypto';
import { eq, and, lt, gt } from 'drizzle-orm';
import { getDatabase, type AppDatabase } from '@/lib/db';
import { agentNonces } from '@/lib/db/schema';
import { recordAudit } from '@/lib/control/audit';
import { AppError, AppErrorCode } from '@/lib/errors/app-error';

/** Default nonce lifetime in milliseconds (5 minutes). */
const DEFAULT_NONCE_TTL_MS = 5 * 60 * 1000;

/** Default nonce cleanup threshold (expired nonces older than this get purged). */
const DEFAULT_CLEANUP_AGE_MS = 60 * 60 * 1000;

/**
 * Issues a short-lived nonce for agent request signing / replay protection.
 * Called by Control when dispatching a command to an agent.
 */
export async function issueAgentNonce(
  serverId: string,
  ttlMs: number = DEFAULT_NONCE_TTL_MS,
  db?: AppDatabase
): Promise<{ nonce: string; expiresAt: Date }> {
  const database = db ?? getDatabase().db;
  const nonce = crypto.randomBytes(32).toString('base64url');
  const nonceHash = crypto.createHash('sha256').update(nonce).digest('hex');
  const expiresAt = new Date(Date.now() + ttlMs);

  await database.insert(agentNonces).values({
    serverId,
    nonceHash,
    expiresAt,
  });

  await recordAudit(null, {
    action: 'agent_nonce_issued',
    description: `Nonce issued for server ${serverId}`,
    severity: 'info',
    metadata: { serverId },
  });

  return { nonce, expiresAt };
}

/**
 * Consumes (validates and marks used) an agent nonce.
 * Throws AppError if the nonce is invalid, expired, already used, or scoped to a different server.
 * This implements replay protection: a nonce can only be used once.
 */
export async function consumeAgentNonce(
  serverId: string,
  nonce: string,
  db?: AppDatabase
): Promise<{ valid: true }> {
  const database = db ?? getDatabase().db;
  const nonceHash = crypto.createHash('sha256').update(nonce).digest('hex');
  const now = new Date();

  const [row] = await database
    .select()
    .from(agentNonces)
    .where(
      and(
        eq(agentNonces.serverId, serverId),
        eq(agentNonces.nonceHash, nonceHash),
        eq(agentNonces.used, false),
        gt(agentNonces.expiresAt, now)
      )
    );

  if (!row) {
    await recordAudit(null, {
      action: 'agent_nonce_consumed',
      description: `Invalid/used/expired nonce presented for server ${serverId}`,
      severity: 'warn',
      metadata: { serverId, reason: 'rejected' },
    });
    throw new AppError(AppErrorCode.FORBIDDEN, 'Invalid or expired nonce');
  }

  // Mark as consumed (single-use).
  await database
    .update(agentNonces)
    .set({ used: true })
    .where(eq(agentNonces.id, row.id));

  await recordAudit(null, {
    action: 'agent_nonce_consumed',
    description: `Nonce consumed for server ${serverId}`,
    severity: 'info',
    metadata: { serverId, nonceId: row.id },
  });

  return { valid: true };
}

/**
 * Signs a request payload using the server token as an HMAC key.
 * This provides request authenticity: the server proves it holds the token
 * without the token ever being transmitted.
 */
export async function signRequest(
  fullToken: string,
  payload: string
): Promise<string> {
  // Use only the secret portion (after the prefix separator) for HMAC.
  const secretPart = fullToken.split('.').pop() ?? fullToken;
  return crypto
    .createHmac('sha256', secretPart)
    .update(payload)
    .digest('base64url');
}

/**
 * Verifies a server-signed HMAC against the stored token.
 */
export async function verifySignature(
  storedToken: string,
  payload: string,
  signature: string
): Promise<boolean> {
  const expected = await signRequest(storedToken, payload);
  // Constant-time comparison to prevent timing attacks.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Purges expired nonces from the database. Safe to run periodically.
 */
export async function purgeExpiredNonces(
  olderThanMs: number = DEFAULT_CLEANUP_AGE_MS,
  db?: AppDatabase
): Promise<number> {
    const database = db ?? getDatabase().db;
  const cutoff = new Date(Date.now() - olderThanMs);
  const deleted = await database
    .delete(agentNonces)
    .where(lt(agentNonces.expiresAt, cutoff))
    .returning();
  return deleted.length;
}
