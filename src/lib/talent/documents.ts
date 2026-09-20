import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { dbFromRequest } from '@/lib/db/request';
import { talentDocuments } from '@/lib/db/schema';
import { recordTalentActivity } from './activity';
import { TalentNotFoundError } from './errors';
import { readDocumentFile } from './storage';

export interface TalentDocumentMeta {
  id: string;
  candidateId: string;
  applicationId: string | null;
  kind: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  uploadedAt: string;
}

function toMeta(row: typeof talentDocuments.$inferSelect): TalentDocumentMeta {
  return {
    id: row.id,
    candidateId: row.candidateId,
    applicationId: row.applicationId,
    kind: row.kind,
    filename: row.originalFilename,
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    uploadedAt: row.createdAt.toISOString(),
  };
}

export async function listCandidateDocuments(candidateId: string): Promise<TalentDocumentMeta[]> {
  const { db } = dbFromRequest();
  const rows = await db.select().from(talentDocuments).where(eq(talentDocuments.candidateId, candidateId)).orderBy(desc(talentDocuments.createdAt)).limit(50);
  return rows.map(toMeta);
}

export async function listApplicationDocuments(applicationId: string): Promise<TalentDocumentMeta[]> {
  const { db } = dbFromRequest();
  const rows = await db.select().from(talentDocuments).where(eq(talentDocuments.applicationId, applicationId)).orderBy(desc(talentDocuments.createdAt)).limit(50);
  return rows.map(toMeta);
}

export interface AuthorizedDocument {
  filename: string;
  mimeType: string;
  bytes: Buffer;
}

/**
 * Owner-only document read.
 *
 * The document is located by its database id (never by a client-supplied path),
 * storage keys are resolved through the traversal-guarded storage helper, the
 * access is counted and every read is written to the talent activity log.
 */
export async function readTalentDocumentForOwner(actor: string | null, documentId: string): Promise<AuthorizedDocument> {
  const { db } = dbFromRequest();
  const rows = await db.select().from(talentDocuments).where(eq(talentDocuments.id, documentId)).limit(1);
  const doc = rows[0] ?? null;
  if (!doc) throw new TalentNotFoundError('document');
  const bytes = await readDocumentFile(doc.storageKey);
  await db.update(talentDocuments).set({ accessCount: doc.accessCount + 1, lastAccessedAt: new Date() }).where(eq(talentDocuments.id, doc.id));
  await recordTalentActivity(actor, {
    entityType: 'document', entityId: doc.candidateId, action: 'document_accessed',
    summary: `Resume viewed: ${doc.originalFilename}`,
    metadata: { documentId: doc.id },
  });
  return { filename: doc.originalFilename, mimeType: doc.mimeType, bytes };
}
