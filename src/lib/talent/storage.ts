import 'server-only';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { config } from '@/lib/config';

/**
 * Private storage for candidate documents (résumés).
 *
 * Security properties:
 *
 *  - Files live OUTSIDE the Next.js `public/` tree, so there is no URL that can
 *    serve them and no static-file path that can leak one.
 *  - The storage key is generated entirely server-side from a random UUID plus
 *    the validated extension. No part of the applicant-supplied filename ever
 *    reaches the filesystem.
 *  - Every read re-resolves the path and refuses anything that does not remain
 *    inside the storage root, so a corrupted or hand-edited `storage_key` (path
 *    traversal) cannot escape the directory.
 *  - Files are written with owner-only permissions (0600); identity comes from
 *    the authenticated session at the route layer, never from the caller.
 */

export class TalentStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TalentStorageError';
  }
}

/** Absolute storage root, resolved once per process. */
export function storageRoot(): string {
  return path.resolve(process.cwd(), config.TALENT_STORAGE_DIR);
}

/**
 * Builds an opaque storage key: `<yyyy>/<mm>/<uuid>.<ext>`.
 * The key is URL-safe and contains no user-controlled characters.
 */
export function buildStorageKey(extension: string, now: Date = new Date()): string {
  const safeExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  if (safeExtension.length === 0) {
    throw new TalentStorageError('A storage key requires a file extension.');
  }
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}/${month}/${crypto.randomUUID()}.${safeExtension}`;
}

const STORAGE_KEY_PATTERN = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.[a-z0-9]{1,8}$/;

/** Validates a storage key shape before it is ever joined to a path. */
export function isSafeStorageKey(key: string): boolean {
  if (typeof key !== 'string' || !STORAGE_KEY_PATTERN.test(key)) return false;
  if (key.includes('..') || key.includes('\\')) return false;
  return true;
}

/**
 * Resolves a storage key to an absolute path, refusing anything that escapes
 * the private root (path traversal / absolute-path injection).
 */
export function resolveStoragePath(key: string): string {
  if (!isSafeStorageKey(key)) {
    throw new TalentStorageError('Invalid storage key.');
  }
  const root = storageRoot();
  const absolute = path.resolve(root, key);
  const rootWithSeparator = root.endsWith(path.sep) ? root : root + path.sep;
  if (!absolute.startsWith(rootWithSeparator)) {
    throw new TalentStorageError('Invalid storage key.');
  }
  return absolute;
}

export interface StoredDocument {
  storageKey: string;
  byteSize: number;
  checksumSha256: string;
}

/** Writes a document to private storage. */
export async function writeDocumentFile(
  extension: string,
  content: Buffer
): Promise<StoredDocument> {
  if (content.byteLength === 0) {
    throw new TalentStorageError('Refusing to store an empty document.');
  }
  const storageKey = buildStorageKey(extension);
  const absolute = resolveStoragePath(storageKey);
  await fs.mkdir(path.dirname(absolute), { recursive: true, mode: 0o700 });
  await fs.writeFile(absolute, content, { mode: 0o600 });
  return {
    storageKey,
    byteSize: content.byteLength,
    checksumSha256: crypto.createHash('sha256').update(content).digest('hex'),
  };
}

/** Reads a document back. Only server routes holding Owner authorisation call this. */
export async function readDocumentFile(storageKey: string): Promise<Buffer> {
  const absolute = resolveStoragePath(storageKey);
  try {
    return await fs.readFile(absolute);
  } catch {
    throw new TalentStorageError('The stored document is no longer available.');
  }
}

/** Removes a document. Failures are reported to the caller, not swallowed. */
export async function deleteDocumentFile(storageKey: string): Promise<void> {
  const absolute = resolveStoragePath(storageKey);
  try {
    await fs.unlink(absolute);
  } catch {
    // Already gone: deletion is idempotent.
  }
}

/**
 * Whether private storage is usable in this deployment. Surfaced in the Owner
 * Room so a missing directory is visible rather than silently failing uploads.
 */
export async function storageStatus(): Promise<{
  configured: boolean;
  writable: boolean;
  directory: string;
}> {
  const root = storageRoot();
  const configured = config.TALENT_STORAGE_DIR.length > 0;
  try {
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    await fs.access(root);
    return { configured, writable: true, directory: root };
  } catch {
    return { configured, writable: false, directory: root };
  }
}