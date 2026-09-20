import { and, asc, desc, eq, ilike, or } from 'drizzle-orm';
import { dbFromRequest } from '@/lib/db/request';
import { talentClients, type TalentClientRow } from '@/lib/db/schema';
import { recordTalentActivity } from './activity';
import { clientStatusLabel, isTalentClientStatus } from './catalog';
import { TalentNotFoundError, TalentValidationError } from './errors';
import type { TalentClientInput } from './schemas';

/**
 * Recruitment clients (the companies Ravelyth Talent sources for).
 *
 * Every function here is called from an Owner-authorised route; this module
 * performs no authorisation of its own, which keeps the rule in exactly one
 * place (the route plus `requireOwner`) rather than duplicated per query.
 *
 * Client contact details are internal business data: they are never rendered on
 * a public page, including on a public job page.
 */

export interface TalentClientDTO {
  id: string;
  companyName: string;
  companyWebsite: string | null;
  industry: string | null;
  companyLocation: string | null;
  companySize: string | null;
  contactName: string | null;
  contactDesignation: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  linkedinUrl: string | null;
  status: string;
  statusLabel: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function toDTO(row: TalentClientRow): TalentClientDTO {
  return {
    id: row.id,
    companyName: row.companyName,
    companyWebsite: row.companyWebsite,
    industry: row.industry,
    companyLocation: row.companyLocation,
    companySize: row.companySize,
    contactName: row.contactName,
    contactDesignation: row.contactDesignation,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    linkedinUrl: row.linkedinUrl,
    status: row.status,
    statusLabel: clientStatusLabel(row.status),
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Validates a status value supplied outside a zod schema. */
function assertStatus(status: string): void {
  if (!isTalentClientStatus(status)) {
    throw new TalentValidationError(`Unknown client status: ${status}`);
  }
}

export async function createTalentClient(
  actorUserId: string | null,
  input: TalentClientInput
): Promise<TalentClientDTO> {
  const { db } = dbFromRequest();
  const status = input.status ?? 'PROSPECT';
  assertStatus(status);

  const [row] = await db
    .insert(talentClients)
    .values({
      companyName: input.companyName,
      companyWebsite: input.companyWebsite ?? null,
      industry: input.industry ?? null,
      companyLocation: input.companyLocation ?? null,
      companySize: input.companySize ?? null,
      contactName: input.contactName ?? null,
      contactDesignation: input.contactDesignation ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      linkedinUrl: input.linkedinUrl ?? null,
      status,
      notes: input.notes ?? null,
    })
    .returning();

  await recordTalentActivity(actorUserId, {
    entityType: 'client',
    entityId: row.id,
    action: 'client_created',
    summary: `Client created: ${row.companyName}`,
    metadata: { status },
  });

  return toDTO(row);
}
export async function updateTalentClient(
  actorUserId: string | null,
  clientId: string,
  input: TalentClientInput
): Promise<TalentClientDTO> {
  const { db } = dbFromRequest();
  const existing = await getTalentClientById(clientId);
  if (!existing) throw new TalentNotFoundError('client');
  const status = input.status ?? existing.status;
  assertStatus(status);

  const [row] = await db
    .update(talentClients)
    .set({
      companyName: input.companyName,
      companyWebsite: input.companyWebsite ?? null,
      industry: input.industry ?? null,
      companyLocation: input.companyLocation ?? null,
      companySize: input.companySize ?? null,
      contactName: input.contactName ?? null,
      contactDesignation: input.contactDesignation ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      linkedinUrl: input.linkedinUrl ?? null,
      status,
      notes: input.notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(talentClients.id, clientId))
    .returning();

  await recordTalentActivity(actorUserId, {
    entityType: 'client',
    entityId: clientId,
    action: 'client_updated',
    summary: `Client updated: ${row.companyName}`,
    metadata: { status },
  });
  if (status !== existing.status) {
    await recordTalentActivity(actorUserId, {
      entityType: 'client',
      entityId: clientId,
      action: 'client_status_changed',
      summary: `Client status: ${existing.status} → ${status}`,
      metadata: { from: existing.status, to: status },
    });
  }

  return toDTO(row);
}

export async function getTalentClientById(clientId: string): Promise<TalentClientRow | null> {
  const { db } = dbFromRequest();
  const rows = await db.select().from(talentClients).where(eq(talentClients.id, clientId)).limit(1);
  return rows[0] ?? null;
}

export async function getTalentClient(clientId: string): Promise<TalentClientDTO> {
  const row = await getTalentClientById(clientId);
  if (!row) throw new TalentNotFoundError('client');
  return toDTO(row);
}

export interface ListTalentClientsOptions {
  query?: string;
  status?: string;
  limit?: number;
}

export async function listTalentClients(
  options: ListTalentClientsOptions = {}
): Promise<TalentClientDTO[]> {
  const { db } = dbFromRequest();
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
  const filters = [];

  if (options.status && isTalentClientStatus(options.status)) {
    filters.push(eq(talentClients.status, options.status));
  }
  if (options.query) {
    // Wildcards are stripped from user input so a search term cannot be used to
    // widen the match into a full-table scan.
    const pattern = `%${options.query.replace(/[%_\\]/g, '')}%`;
    filters.push(
      or(
        ilike(talentClients.companyName, pattern),
        ilike(talentClients.contactName, pattern),
        ilike(talentClients.contactEmail, pattern)
      )
    );
  }

  const rows =
    filters.length > 0
      ? await db
          .select()
          .from(talentClients)
          .where(and(...filters))
          .orderBy(desc(talentClients.createdAt))
          .limit(limit)
      : await db
          .select()
          .from(talentClients)
          .orderBy(desc(talentClients.createdAt))
          .limit(limit);

  return rows.map(toDTO);
}

/** Client picker options for the job form. */
export async function listClientOptions(): Promise<
  Array<{ id: string; companyName: string; status: string }>
> {
  const { db } = dbFromRequest();
  return db
    .select({
      id: talentClients.id,
      companyName: talentClients.companyName,
      status: talentClients.status,
    })
    .from(talentClients)
    .orderBy(asc(talentClients.companyName))
    .limit(500);
}