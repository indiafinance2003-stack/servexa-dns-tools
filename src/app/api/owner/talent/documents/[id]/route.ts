import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '@/lib/errors/app-error';
import { enforceRequestGuards, sendError } from '@/lib/errors/api-handler';
import { requireOwner } from '@/lib/admin/guards';
import { toAppError } from '@/lib/talent/api';
import { readTalentDocumentForOwner } from '@/lib/talent/documents';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/owner/talent/documents/[id]
 *
 * The ONLY document download path. Owner-authenticated, streamed from private
 * storage as an attachment (never rendered inline), storage keys and paths are
 * never exposed, and each access is recorded in the talent activity log by the
 * service layer.
 *
 * The file bytes are returned as the response body rather than wrapped in the
 * JSON envelope used by other endpoints, so the download is the document itself.
 */
export async function GET(req: NextRequest, ctx: RouteContext): Promise<Response> {
  try {
    enforceRequestGuards(req);
    const actor = await requireOwner();
    const { id } = await ctx.params;
    const doc = await readTalentDocumentForOwner(actor.id, id);
    // Quotes, backslashes and control characters are stripped so a stored
    // filename can never inject a header or truncate the Content-Disposition.
    // eslint-disable-next-line no-control-regex
    const safeName = doc.filename.replace(/["\\\r\n\u0000-\u001f]/g, '') || 'resume';
    return new NextResponse(new Uint8Array(doc.bytes), {
      status: 200,
      headers: {
        'Content-Type': doc.mimeType,
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Content-Length': String(doc.bytes.byteLength),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const mapped = error instanceof AppError ? error : toAppError(error);
    if (mapped instanceof AppError) return sendError(mapped);
    return sendError(new Error('The document could not be read.'));
  }
}
