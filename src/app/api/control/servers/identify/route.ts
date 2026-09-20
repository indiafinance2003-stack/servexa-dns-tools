import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleApi, readJsonBody } from '@/lib/errors/api-handler';
import { parseWithSchema } from '@/lib/validation/parse';
import { validateServerToken } from '@/lib/control/servers';
import { issueAgentNonce } from '@/lib/control/agent-auth';
import { AppError, AppErrorCode } from '@/lib/errors/app-error';

const identifySchema = z.object({
  serverToken: z.string().min(1),
  requestedNonceTtlMs: z.number().min(1000).max(3600000).optional(),
});

/**
 * POST /api/control/servers/identify
 * Agent-facing endpoint: presents server token, gets a nonce back for
 * signing subsequent requests.
 */
export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => {
    const body = await readJsonBody(req);
    const input = parseWithSchema(identifySchema, body);
    const server = await validateServerToken(input.serverToken);
    if (!server) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, 'Invalid server token', 401);
    }
    const nonceResult = await issueAgentNonce(
      server.id,
      input.requestedNonceTtlMs
    );
    return {
      serverId: server.id,
      serverName: server.name,
      nonce: nonceResult.nonce,
      expiresAt: nonceResult.expiresAt.toISOString(),
    };
  });
}
