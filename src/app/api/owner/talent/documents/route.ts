import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleApi, parseWithSchema } from '@/lib/errors/api-handler';
import { AppError, AppErrorCode } from '@/lib/errors/app-error';
import { requireOwner } from '@/lib/admin/guards';
import { withTalentErrors } from '@/lib/talent/api';
import { listCandidateDocuments } from '@/lib/talent/documents';

const querySchema = z.object({ candidateId: z.string().uuid('candidateId is required') }).strict();

/** GET /api/owner/talent/documents?candidateId=… — Owner-only document metadata. */
export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(
    req,
    withTalentErrors(async () => {
      await requireOwner();
      const raw = { candidateId: req.nextUrl.searchParams.get('candidateId') ?? '' };
      const query = parseWithSchema(querySchema, raw);
      const documents = await listCandidateDocuments(query.candidateId);
      return { documents };
    })
  );
}

/** Other methods are not supported on the collection route. */
export async function POST(): Promise<Response> {
  throw new AppError(AppErrorCode.VALIDATION_ERROR, 'Uploads happen through the public application flow.', 405);
}
