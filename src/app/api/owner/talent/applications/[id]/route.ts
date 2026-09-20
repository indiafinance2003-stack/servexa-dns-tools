import { NextRequest } from 'next/server';
import { handleApi, parseWithSchema, readJsonBody } from '@/lib/errors/api-handler';
import { requireOwner } from '@/lib/admin/guards';
import { withTalentErrors } from '@/lib/talent/api';
import {
  talentApplicationNotesSchema,
  talentApplicationStatusSchema,
} from '@/lib/talent/schemas';
import { getApplication, transitionApplication, updateApplicationNotes } from '@/lib/talent/candidates';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** GET /api/owner/talent/applications/[id] — Owner-only application detail. */
export async function GET(req: NextRequest, ctx: RouteContext): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      await requireOwner();
      const { id } = await ctx.params;
      const application = await getApplication(id);
      return { application };
    })
  );
}

/**
 * PATCH /api/owner/talent/applications/[id]
 * Status transitions go through the policy-validated pipeline. A
 * CLIENT_SUBMITTED move is only accepted when the candidate-contact /
 * confirmation precondition holds (enforced in the service, not the UI).
 */
export async function PATCH(req: NextRequest, ctx: RouteContext): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      const actor = await requireOwner();
      const { id } = await ctx.params;
      const body = await readJsonBody(req);
      if ('status' in body) {
        const input = parseWithSchema(talentApplicationStatusSchema, body);
        const application = await transitionApplication(actor.id, id, input.status, {
          note: input.note,
        });
        return { application };
      }
      const notes = parseWithSchema(talentApplicationNotesSchema, body);
      const application = await updateApplicationNotes(actor.id, id, notes);
      return { application };
    })
  );
}
