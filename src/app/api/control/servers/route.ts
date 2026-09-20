import { NextRequest } from 'next/server';
import { z } from 'zod';
import { handleApi, readJsonBody } from '@/lib/errors/api-handler';
import { parseWithSchema } from '@/lib/validation/parse';
import { requireOwner } from '@/lib/admin/guards';
import { registerServer, getActiveServers, updateServerStatus, SERVER_STATUSES } from '@/lib/control/servers';

const registerSchema = z.object({
  name: z.string().min(1, 'Server name is required').max(255),
  registeredHost: z.string().max(255).nullish(),
  organizationId: z.string().uuid().nullish(),
});

const updateStatusSchema = z.object({
  serverId: z.string().uuid(),
  status: z.enum(SERVER_STATUSES),
});

/**
 * POST /api/control/servers
 * Register a new server. Owner-only.
 */
export async function POST(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => {
    const actor = await requireOwner();
    const body = await readJsonBody(req);
    const input = parseWithSchema(registerSchema, body);
    const result = await registerServer(actor.id, input);
    return result;
  }, () => 201);
}

/**
 * GET /api/control/servers
 * List active servers. Owner-only.
 */
export async function GET(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => {
    await requireOwner();
    const servers = await getActiveServers();
    return { servers: servers.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      registeredHost: s.registeredHost,
      lastSeenAt: s.lastSeenAt,
      createdAt: s.createdAt,
    })) };
  });
}

/**
 * PATCH /api/control/servers
 * Update server status. Owner-only.
 */
export async function PATCH(req: NextRequest): Promise<Response> {
  return handleApi(req, async () => {
    const actor = await requireOwner();
    const body = await readJsonBody(req);
    const input = parseWithSchema(updateStatusSchema, body);
    const result = await updateServerStatus(actor.id, input.serverId, input.status);
    if (!result) {
      return { success: false, message: 'Server not found' };
    }
    return { success: true, server: result };
  });
}
