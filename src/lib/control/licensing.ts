import 'server-only';
import crypto from 'crypto';
import { eq, and, lt } from 'drizzle-orm';
import { config } from '@/lib/config';
import { getDatabase, type AppDatabase } from '@/lib/db';
import { licenses, type LicenseRow } from '@/lib/db/schema';
import { recordAudit } from '@/lib/control/audit';

/** License status values. */
export const LICENSE_STATUSES = ['active', 'suspended', 'expired', 'revoked'] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

/** A full license key with prefix and secret. */
export interface LicenseKey {
  prefix: string;
  key: string;
  fullKey: string;
}

/** License issuance parameters. */
export interface LicenseIssuanceParams {
  customerId?: string | null;
  organizationId?: string | null;
  capabilities?: Record<string, unknown>;
  expiresAt?: Date | null;
}

/** Result of issuing a license. */
export interface LicenseIssuedResult {
  id: string;
  licenseKey: LicenseKey;
  status: LicenseStatus;
  expiresAt: Date | null;
}

/**
 * Generates a cryptographically secure license key.
 */
function generateLicenseKeypair(): LicenseKey {
  const secret = crypto.randomBytes(32);
  const key = secret.toString('base64url');
  const prefix = config.CONTROL_LICENSE_KEY_PREFIX.replace(/[^A-Z0-9]/gi, '') || 'RVLY-LIC';
  return { prefix, key, fullKey: `${prefix}-${key}` };
}

/**
 * Hashes a license key secret using SHA-256. The full key is never stored.
 */
function hashLicenseKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Validates the format of a license key. Returns prefix and secret if valid.
 */
export function parseLicenseKey(fullKey: string): { prefix: string; secret: string } | null {
  const trimmed = fullKey.trim();
  const match = trimmed.match(/^([A-Z0-9]+(?:-[A-Z0-9]+)*)-(.+)$/i);
  if (!match) return null;
  const [, prefix, secret] = match;
    if (secret.length < 32) return null;
  return { prefix, secret };
}

/**
 * Issues a new license key. Internal/admin-only operation.
 */
export async function issueLicense(
  actorUserId: string | null,
  params: LicenseIssuanceParams,
  db?: AppDatabase
): Promise<LicenseIssuedResult> {
  const database = db ?? getDatabase().db;
  const keypair = generateLicenseKeypair();
  const keyHash = hashLicenseKey(keypair.fullKey);

  const [row] = await database
    .insert(licenses)
    .values({
      keyHash,
      keyPrefix: keypair.prefix,
      customerId: params.customerId ?? null,
      organizationId: params.organizationId ?? null,
      status: 'active',
      capabilities: params.capabilities ?? {},
      expiresAt: params.expiresAt ?? null,
    })
    .returning();

  await recordAudit(actorUserId, {
    action: 'license_issued',
    description: `License issued (customer: ${params.customerId ?? 'none'}, org: ${params.organizationId ?? 'none'})`,
    severity: 'info',
    metadata: { licenseId: row.id, keyPrefix: keypair.prefix },
  });

  return {
    id: row.id,
    licenseKey: keypair,
    status: row.status as LicenseStatus,
    expiresAt: row.expiresAt,
  };
}

/**
 * Validates a license key and returns the associated license row.
 * Returns null if invalid, expired, or revoked.
 */
export async function validateLicense(
  fullKey: string,
  db?: AppDatabase
): Promise<LicenseRow | null> {
  const parsed = parseLicenseKey(fullKey);
  if (!parsed) return null;

  const keyHash = hashLicenseKey(fullKey);
  const database = db ?? getDatabase().db;

  const [row] = await database
    .select()
    .from(licenses)
    .where(eq(licenses.keyHash, keyHash));

  if (!row) return null;
  if (row.status === 'revoked') return null;
  if (row.expiresAt && new Date(row.expiresAt) < new Date()) return null;

  return row;
}

/**
 * Returns the capabilities granted by a valid license.
 */
export async function getLicenseCapabilities(
  fullKey: string
): Promise<Record<string, unknown> | null> {
  const license = await validateLicense(fullKey);
  if (!license) return null;
  return (license.capabilities || {}) as Record<string, unknown>;
}

/**
 * Changes the status of a license. Caller must be admin.
 */
export async function updateLicenseStatus(
  actorUserId: string | null,
  licenseId: string,
  status: LicenseStatus,
  db?: AppDatabase
): Promise<LicenseRow | null> {
  const database = db ?? getDatabase().db;
  const [row] = await database
    .update(licenses)
    .set({ status, updatedAt: new Date() })
    .where(eq(licenses.id, licenseId))
    .returning();

  if (row) {
    await recordAudit(actorUserId, {
      action: 'license_status_changed',
      description: `License ${licenseId} status changed to ${status}`,
      severity: status === 'revoked' ? 'warn' : 'info',
      metadata: { licenseId, status },
    });
  }
  return row ?? null;
}

/**
 * Retrieves licenses for a given customer.
 */
export async function getLicensesForCustomer(
  customerId: string,
  db?: AppDatabase
): Promise<LicenseRow[]> {
  const database = db ?? getDatabase().db;
  return database
    .select()
    .from(licenses)
    .where(eq(licenses.customerId, customerId));
}

/**
 * Returns IDs of expired active licenses — for cleanup/cron jobs.
 */
export async function getExpiredLicenseIds(db?: AppDatabase): Promise<string[]> {
  const database = db ?? getDatabase().db;
  const now = new Date();
  const rows = await database
    .select({ id: licenses.id })
    .from(licenses)
    .where(and(eq(licenses.status, 'active'), lt(licenses.expiresAt, now)));
  return rows.map((r) => r.id);
}
