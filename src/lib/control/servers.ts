import 'server-only';
import crypto from 'crypto';
import { eq, ne } from 'drizzle-orm';
import { config } from '@/lib/config';
import { getDatabase, type AppDatabase } from '@/lib/db';
import { controlServers, type ControlServerRow } from '@/lib/db/schema';
import { recordAudit } from '@/lib/control/audit';

/** Status values for a registered control server. */
export const SERVER_STATUSES = ['active', 'suspended', 'deactivated'] as const;
export type ServerStatus = (typeof SERVER_STATUSES)[number];

/** A server token with prefix and secret. */
export interface ServerToken {
  prefix: string;
  token: string;
  fullToken: string;
}

/** Server registration parameters. */
export interface ServerRegistrationParams {
  name: string;
  registeredHost?: string | null;
  organizationId?: string | null;
}

/** Result of server registration. */
export interface ServerRegisteredResult {
  id: string;
  name: string;
  status: ServerStatus;
  token: ServerToken;
}

/**
 * Hashes a server token using SHA-256. The raw token is never stored.
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generates a cryptographically secure server registration token.
 */
function generateServerToken(): ServerToken {
  const secret = crypto.randomBytes(32);
  const token = secret.toString('base64url');
  const prefix = config.CONTROL_SERVER_TOKEN_PREFIX || 'rvly-srv';
  return { prefix, token, fullToken: `${prefix}.${token}` };
}

/**
 * Registers a new server in Ravelyth Control. Admin-only.
 */
export async function registerServer(
  actorUserId: string | null,
  params: ServerRegistrationParams,
  db?: AppDatabase
): Promise<ServerRegisteredResult> {
  const database = db ?? getDatabase().db;
  const keypair = generateServerToken();
  const tokenHash = hashToken(keypair.fullToken);

  const [row] = await database
    .insert(controlServers)
    .values({
      name: params.name,
      organizationId: params.organizationId ?? null,
      tokenHash,
      tokenPrefix: keypair.prefix,
      registeredHost: params.registeredHost ?? null,
      status: 'active',
    })
    .returning();

  await recordAudit(actorUserId, {
    action: 'server_registered',
    description: `Server registered: ${params.name}`,
    severity: 'info',
    metadata: { serverId: row.id, name: params.name },
  });

  return {
    id: row.id,
    name: row.name,
    status: row.status as ServerStatus,
    token: keypair,
  };
}

/**
 * Validates a server token and returns the server row.
 * Returns null if invalid or deactivated.
 */
export async function validateServerToken(
  fullToken: string,
  db?: AppDatabase
): Promise<ControlServerRow | null> {
  if (!fullToken || !fullToken.includes('.')) return null;

  const tokenHash = hashToken(fullToken.trim());
  const database = db ?? getDatabase().db;

  const [row] = await database
    .select()
    .from(controlServers)
    .where(eq(controlServers.tokenHash, tokenHash));

  if (!row) return null;
  if (row.status === 'deactivated') return null;

  // Update lastSeenAt
  await database
    .update(controlServers)
    .set({ lastSeenAt: new Date() })
    .where(eq(controlServers.id, row.id));

  return row;
}

/**
 * Changes the status of a server. Admin-only.
 */
export async function updateServerStatus(
  actorUserId: string | null,
  serverId: string,
  status: ServerStatus,
  db?: AppDatabase
): Promise<ControlServerRow | null> {
  const database = db ?? getDatabase().db;
  const [row] = await database
    .update(controlServers)
    .set({ status, updatedAt: new Date() })
    .where(eq(controlServers.id, serverId))
    .returning();

  if (row) {
    await recordAudit(actorUserId, {
      action: 'server_status_changed',
      description: `Server '${row.name}' (${serverId}) status changed to ${status}`,
      severity: status === 'deactivated' || status === 'suspended' ? 'warn' : 'info',
      metadata: { serverId, status },
    });
  }
  return row ?? null;
}

/**
 * Retrieves an organization's servers.
 */
export async function getServersForOrganization(
  organizationId: string,
  db?: AppDatabase
): Promise<ControlServerRow[]> {
  const database = db ?? getDatabase().db;
  return database
    .select()
    .from(controlServers)
    .where(eq(controlServers.organizationId, organizationId));
}

/**
 * Returns all active servers (for admin listing).
 */
export async function getActiveServers(db?: AppDatabase): Promise<ControlServerRow[]> {
  const database = db ?? getDatabase().db;
  return database
    .select()
    .from(controlServers)
    .where(ne(controlServers.status, 'deactivated'));
}
