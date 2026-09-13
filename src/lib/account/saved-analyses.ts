import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { requireDatabase } from '@/lib/db/require-database';
import { savedAnalyses, type SavedAnalysisRow } from '@/lib/db/schema';

/**
 * Saved analyses persistence. Saving is always an explicit user action —
 * lookups are never recorded automatically. Only structured DNS results are
 * accepted; raw email headers are intentionally not saveable.
 */

export const ALLOWED_ANALYSIS_TYPES = ['dns_lookup'] as const;

export const savedAnalysisInputSchema = z.object({
  analysisType: z.enum(ALLOWED_ANALYSIS_TYPES),
  target: z.string().trim().min(1).max(253),
  result: z
    .record(z.unknown())
    .refine((value) => JSON.stringify(value).length <= 131072, {
      message: 'Result payload is too large to save',
    }),
});

export type SavedAnalysisInput = z.infer<typeof savedAnalysisInputSchema>;

export interface SavedAnalysisSummary {
  id: string;
  analysisType: string;
  target: string;
  result: unknown;
  createdAt: Date;
}

export async function listSavedAnalyses(userId: string): Promise<SavedAnalysisSummary[]> {
  const { db } = requireDatabase();
  const rows: SavedAnalysisRow[] = await db
    .select()
    .from(savedAnalyses)
    .where(eq(savedAnalyses.userId, userId))
    .orderBy(desc(savedAnalyses.createdAt))
    .limit(100);

  return rows.map((row) => ({
    id: row.id,
    analysisType: row.analysisType,
    target: row.target,
    result: row.resultJson,
    createdAt: row.createdAt,
  }));
}

export async function createSavedAnalysis(
  userId: string,
  input: SavedAnalysisInput
): Promise<SavedAnalysisSummary> {
  const { db } = requireDatabase();
  const inserted = await db
    .insert(savedAnalyses)
    .values({
      userId,
      analysisType: input.analysisType,
      target: input.target,
      resultJson: input.result,
    })
    .returning();

  const row = inserted[0];
  return {
    id: row.id,
    analysisType: row.analysisType,
    target: row.target,
    result: row.resultJson,
    createdAt: row.createdAt,
  };
}

export async function deleteSavedAnalysis(userId: string, id: string): Promise<boolean> {
  const { db } = requireDatabase();
  // The userId condition enforces per-user isolation at the query level.
  const deleted = await db
    .delete(savedAnalyses)
    .where(and(eq(savedAnalyses.id, id), eq(savedAnalyses.userId, userId)))
    .returning({ id: savedAnalyses.id });
  return deleted.length > 0;
}
