import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleApi, parseWithSchema, readJsonBody } from '@/lib/errors/api-handler';
import { requireOwner } from '@/lib/admin/guards';
import { withTalentErrors } from '@/lib/talent/api';
import { getCandidate, updateCandidateNotes } from '@/lib/talent/candidates';
import { listCandidateDocuments } from '@/lib/talent/documents';
import { listApplications } from '@/lib/talent/candidates';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const notesSchema = z.object({ internalNotes: z.string().max(4000).nullable() }).strict();

/** GET /api/owner/talent/candidates/[id] — Owner-only candidate PII view. */
export async function GET(req: NextRequest, ctx: RouteContext): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      await requireOwner();
      const { id } = await ctx.params;
      const [candidate, documents, applications] = await Promise.all([
        getCandidate(id),
        listCandidateDocuments(id),
        listApplications({ candidateUuid: id }),
      ]);
      return { candidate, documents, applications };
    })
  );
}

/** PATCH /api/owner/talent/candidates/[id] — Owner-only internal notes update. */
export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      const actor = await requireOwner();
      const { id } = await ctx.params;
      const body = await readJsonBody(req);
      const { internalNotes } = parseWithSchema(notesSchema, body);
      const candidate = await updateCandidateNotes(actor.id, id, internalNotes);
      return { candidate };
    })
  );
}
