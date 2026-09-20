import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { config } from '@/lib/config';
import { dbFromRequest } from '@/lib/db/request';
import {
  supportMessages,
  supportTickets,
  type SupportMessageRow,
  type SupportTicketRow,
} from '@/lib/db/schema';
import { parseWithSchema } from '@/lib/validation/parse';
import { ACTIVE_SUPPORT_STATUSES } from './catalog';
import type { SupportResponsibility } from '@/lib/db/schema';
import {
  InvalidTicketStateError,
  MessageNotFoundError,
  SupportLimitReachedError,
  TicketNotFoundError,
} from './errors';
import {
  canCustomerClose,
  canCustomerConfirmResolution,
  canCustomerReopen,
  canCustomerReply,
  defaultResponsibilityFor,
  exceedsOpenTicketLimit,
  serviceSlugForCategory,
  statusAfterCustomerReply,
} from './policy';
import { createTicketSchema, type CreateTicketInput } from './schemas';
import { getManagedSupportEntitlement } from './entitlement';
import { generateTicketReference } from './reference';
import { safeCreateNotification } from '@/lib/notifications/notifications';

/**
 * Support ticket service (customer-facing side).
 *
 * Ownership rules enforced here, not in the UI:
 *   - the acting user id is always supplied by the caller from the session;
 *   - every read/write is filtered by `user_id`;
 *   - a ticket belonging to another account raises TicketNotFoundError (404)
 *     rather than a 403, so ticket ids cannot be enumerated;
 *   - internal messages are stripped before any customer view is returned.
 *
 * Internal notes are stored in `support_messages` with `is_internal = true` and
 * are only ever selected by the admin service.
 */

export interface CustomerTicketSummary {
  id: string;
  reference: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  origin: string;
  responsibility: string;
  affectedDomain: string | null;
  relatedTool: string | null;
  relatedService: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface CustomerTicketDetail extends CustomerTicketSummary {
  description: string;
  messages: Array<{
    id: string;
    authorRole: string;
    body: string;
    createdAt: string;
  }>;
  capabilities: {
    canReply: boolean;
    canClose: boolean;
    canReopen: boolean;
    canConfirmResolution: boolean;
  };
  /** Diagnostic context captured when the ticket was created (if any). */
  context: Record<string, unknown> | null;
}

/** Human-readable ticket references come from the stored unique column
 * (RT-2026-XXXXXXXX, see ./reference.ts) — never derived from the id. */
function toSummary(row: SupportTicketRow, messageCount = 0): CustomerTicketSummary {
  return {
    id: row.id,
    reference: row.reference,
    subject: row.subject,
    category: row.category,
    priority: row.priority,
    status: row.status,
    origin: row.origin,
    responsibility: row.responsibility,
    affectedDomain: row.affectedDomain,
    relatedTool: row.relatedTool,
    relatedService: row.serviceSlug,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messageCount,
  };
}

function toCustomerMessage(row: SupportMessageRow) {
  return {
    id: row.id,
    authorRole: row.authorRole,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface CreateTicketResult {
  ticket: CustomerTicketDetail;
  entitlementUsed: 'managed_support' | 'public_request';
}

/**
 * Loads one ticket owned by `userId`, or throws TicketNotFoundError.
 * Used internally by every customer-scoped mutation so ownership is checked in
 * exactly one place.
 */
async function requireOwnedTicket(userId: string, ticketId: string): Promise<SupportTicketRow> {
  const { db } = dbFromRequest();
  const rows = await db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, userId)))
    .limit(1);

  const row = rows[0];
  if (!row) throw new TicketNotFoundError();
  return row;
}

/**
 * Creates a ticket for the authenticated customer.
 *
 * The origin is decided by the verified entitlement, NOT by the client:
 *   - an entitled account gets a `managed_support` ticket;
 *   - an account without a plan gets a `public_request` ticket, which is
 *     clearly labelled so support staff know no service agreement is in place.
 *
 * Limits are enforced against the ticket's own origin bucket so a public
 * request can never consume a Managed Support allowance and vice versa.
 */
export async function createCustomerTicket(
  userId: string,
  input: CreateTicketInput,
  options: { origin?: 'managed_support' | 'public_request' } = {}
): Promise<CreateTicketResult> {
  const parsed = parseWithSchema(createTicketSchema, input);
  const entitlement = await getManagedSupportEntitlement(userId);

  // `options.origin` lets callers deliberately request the public flow (for
  // example /support/request). A client can never ask for `managed_support`.
  const requestedPublic = options.origin === 'public_request';
  const origin: 'managed_support' | 'public_request' =
    entitlement.entitled && !requestedPublic ? 'managed_support' : 'public_request';

  if (origin === 'managed_support' && !entitlement.entitled) {
    // Defensive: cannot happen given the branch above, but keeps the invariant
    // explicit if the logic is ever changed.
    throw new SupportLimitReachedError('Managed Support is not active on this account.');
  }

  const { db } = dbFromRequest();

  const activeRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(supportTickets)
    .where(
      and(
        eq(supportTickets.userId, userId),
        eq(supportTickets.origin, origin),
        inArray(supportTickets.status, ACTIVE_SUPPORT_STATUSES)
      )
    );

  const activeCount = activeRows[0]?.count ?? 0;
  const limit =
    origin === 'managed_support'
      ? entitlement.maxOpenTickets
      : config.SUPPORT_MAX_OPEN_PUBLIC_REQUESTS;

  if (exceedsOpenTicketLimit(activeCount, limit)) {
    throw new SupportLimitReachedError(
      origin === 'managed_support'
        ? `You have reached the open ticket limit (${limit}) included in Managed Support. Close or resolve an existing ticket first.`
        : `You already have ${activeCount} open support request(s). Close one of them before opening another.`
    );
  }

  const tool = parsed.relatedTool || parsed.context?.tool || null;
  const context = parsed.context ? sanitizeContext(parsed.context) : null;

  const inserted = await db
    .insert(supportTickets)
    .values({
      userId,
      reference: generateTicketReference(),
      subject: parsed.subject,
      description: parsed.description,
      category: parsed.category,
      priority: parsed.priority ?? 'normal',
      status: 'open',
      origin,
      responsibility: defaultResponsibilityFor(parsed.category),
      affectedDomain: parsed.affectedDomain ?? null,
      relatedTool: tool,
      serviceSlug: serviceSlugForCategory(parsed.category),
      entitlementSource: origin === 'managed_support' ? 'subscription' : 'public_request_flow',
      contextJson: context,
      lastMessageAt: new Date(),
    })
    .returning();

  const ticket = inserted[0];

  await db.insert(supportMessages).values({
    ticketId: ticket.id,
    authorUserId: userId,
    authorRole: 'customer',
    body: parsed.description,
    isInternal: false,
  });

  await safeCreateNotification({
    userId,
    type: 'ticket_created',
    title:
      origin === 'managed_support'
        ? `Support ticket ${ticket.reference} created`
        : `Support request ${ticket.reference} received`,
    body: parsed.subject,
    link: `/account/support/${ticket.id}`,
  });

  return {
    ticket: await getCustomerTicket(userId, ticket.id),
    entitlementUsed: origin,
  };
}

/** Keeps only the whitelisted, non-sensitive context keys, bounded in size. */
function sanitizeContext(context: NonNullable<CreateTicketInput['context']>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (context.tool) out.tool = context.tool;
  if (context.domain) out.domain = context.domain.slice(0, 253).toLowerCase();
  if (context.findingSummary) out.findingSummary = context.findingSummary.slice(0, 400);
  if (context.findingCounts) out.findingCounts = context.findingCounts;
  if (context.diagnosticReference) out.diagnosticReference = context.diagnosticReference.slice(0, 64);
  if (context.capturedAt) out.capturedAt = context.capturedAt.slice(0, 40);
  return out;
}

export interface ListCustomerTicketsOptions {
  status?: string;
  limit?: number;
}

/**
 * Lists tickets belonging to one customer. The WHERE clause always includes
 * `user_id`, so cross-tenant leakage is impossible even if a caller passes an
 * unexpected status filter.
 */
export async function listCustomerTickets(
  userId: string,
  options: ListCustomerTicketsOptions = {}
): Promise<CustomerTicketSummary[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const { db } = dbFromRequest();

  const filters = [eq(supportTickets.userId, userId)];
  if (options.status) filters.push(eq(supportTickets.status, options.status as never));

  const rows = await db
    .select()
    .from(supportTickets)
    .where(and(...filters))
    .orderBy(desc(supportTickets.updatedAt))
    .limit(limit);

  if (rows.length === 0) return [];

  const counts = await db
    .select({
      ticketId: supportMessages.ticketId,
      count: sql<number>`count(*)::int`,
    })
    .from(supportMessages)
    .where(
      and(
        inArray(
          supportMessages.ticketId,
          rows.map((row) => row.id)
        ),
        eq(supportMessages.isInternal, false)
      )
    )
    .groupBy(supportMessages.ticketId);

  const countMap = new Map(counts.map((row) => [row.ticketId, row.count]));
  return rows.map((row) => toSummary(row, countMap.get(row.id) ?? 0));
}

/**
 * Retrieves a single ticket for its owner, with ONLY customer-visible messages.
 * Internal notes are filtered out by the `is_internal = false` predicate in the
 * query itself, so internal content never reaches this code path.
 */
export async function getCustomerTicket(
  userId: string,
  ticketId: string
): Promise<CustomerTicketDetail> {
  const ticket = await requireOwnedTicket(userId, ticketId);
  const { db } = dbFromRequest();

  const messages = await db
    .select()
    .from(supportMessages)
    .where(and(eq(supportMessages.ticketId, ticket.id), eq(supportMessages.isInternal, false)))
    .orderBy(supportMessages.createdAt);

  return {
    ...toSummary(ticket, messages.length),
    description: ticket.description,
    messages: messages.map(toCustomerMessage),
    capabilities: {
      canReply: canCustomerReply(ticket.status),
      canClose: canCustomerClose(ticket.status),
      canReopen: canCustomerReopen(ticket.status),
      canConfirmResolution: canCustomerConfirmResolution(ticket.status),
    },
    context: (ticket.contextJson as Record<string, unknown> | null) ?? null,
  };
}

/**
 * Adds a customer reply. Replying to a ticket that is waiting on the customer
 * moves it back to 'in_progress' so it reappears in the staff queue.
 */
export async function replyToCustomerTicket(
  userId: string,
  ticketId: string,
  body: string
): Promise<CustomerTicketDetail> {
  const ticket = await requireOwnedTicket(userId, ticketId);
  if (!canCustomerReply(ticket.status)) {
    throw new InvalidTicketStateError(
      'This ticket is closed. Reopen it instead so the request returns to the support queue.'
    );
  }

  const { db } = dbFromRequest();
  await db.insert(supportMessages).values({
    ticketId: ticket.id,
    authorUserId: userId,
    authorRole: 'customer',
    body,
    isInternal: false,
  });

  const nextStatus = statusAfterCustomerReply(ticket.status) ?? ticket.status;
  await db
    .update(supportTickets)
    .set({ status: nextStatus, updatedAt: new Date() })
    .where(eq(supportTickets.id, ticket.id));

  return getCustomerTicket(userId, ticket.id);
}

export type CustomerTicketAction = 'close' | 'confirm_resolution' | 'reopen';

/**
 * Customer-initiated lifecycle actions. Each one validates that the transition
 * is permitted from the ticket's current state before writing, and records a
 * system timeline message so the history stays complete.
 */
export async function applyCustomerTicketAction(
  userId: string,
  ticketId: string,
  action: CustomerTicketAction,
  note?: string
): Promise<CustomerTicketDetail> {
  const ticket = await requireOwnedTicket(userId, ticketId);
  const { db } = dbFromRequest();

  let nextStatus: string;
  let systemBody: string;

  switch (action) {
    case 'close': {
      if (!canCustomerClose(ticket.status)) {
        throw new InvalidTicketStateError('This ticket is already closed or resolved.');
      }
      nextStatus = 'closed';
      systemBody = note?.trim()
        ? `Customer closed the ticket: ${note.trim()}`
        : 'Customer closed the ticket.';
      break;
    }
    case 'confirm_resolution': {
      if (!canCustomerConfirmResolution(ticket.status)) {
        throw new InvalidTicketStateError('Only a resolved ticket can be confirmed.');
      }
      nextStatus = 'closed';
      systemBody = note?.trim()
        ? `Customer confirmed the resolution: ${note.trim()}`
        : 'Customer confirmed the resolution.';
      break;
    }
    case 'reopen': {
      if (!canCustomerReopen(ticket.status)) {
        throw new InvalidTicketStateError('Only a resolved or closed ticket can be reopened.');
      }
      nextStatus = 'open';
      systemBody = note?.trim()
        ? `Customer reopened the ticket: ${note.trim()}`
        : 'Customer reopened the ticket.';
      break;
    }
    default: {
      throw new InvalidTicketStateError('Unsupported ticket action.');
    }
  }

  await db
    .update(supportTickets)
    .set({
      status: nextStatus,
      updatedAt: new Date(),
      resolvedAt: nextStatus === 'closed' ? new Date() : ticket.resolvedAt,
    })
    .where(eq(supportTickets.id, ticket.id));

  // Lifecycle messages are customer-visible and authored by the system so the
  // timeline reads clearly without impersonating a person.
  await db.insert(supportMessages).values({
    ticketId: ticket.id,
    authorUserId: null,
    authorRole: 'system',
    body: systemBody,
    isInternal: false,
  });

  await safeCreateNotification({
    userId,
    type: 'ticket_status_changed',
    title: `${ticket.reference} is now ${nextStatus.replace(/_/g, ' ')}`,
    body: ticket.subject,
    link: `/account/support/${ticket.id}`,
  });

  return getCustomerTicket(userId, ticket.id);
}

/**
 * Aggregate support status for the customer portal dashboard. Counts are
 * computed from real rows only — an account with no tickets reports zero.
 */
export async function getCustomerSupportOverview(userId: string): Promise<{
  total: number;
  active: number;
  resolved: number;
  closed: number;
  waitingForCustomer: number;
  latest: CustomerTicketSummary[];
}> {
  const { db } = dbFromRequest();
  const rows = await db
    .select({ status: supportTickets.status })
    .from(supportTickets)
    .where(eq(supportTickets.userId, userId));

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    total: rows.length,
    active: (counts.open ?? 0) + (counts.in_progress ?? 0) + (counts.waiting_for_customer ?? 0),
    resolved: counts.resolved ?? 0,
    closed: counts.closed ?? 0,
    waitingForCustomer: counts.waiting_for_customer ?? 0,
    latest: await listCustomerTickets(userId, { limit: 3 }),
  };
}

/**
 * Ownership guard for a single message. Used by admin tooling and tests to
 * prove that a message id alone never grants access to another account's data.
 */
export async function requireOwnedMessage(
  userId: string,
  messageId: string
): Promise<SupportMessageRow> {
  const { db } = dbFromRequest();
  const rows = await db
    .select({ message: supportMessages })
    .from(supportMessages)
    .innerJoin(supportTickets, eq(supportMessages.ticketId, supportTickets.id))
    .where(and(eq(supportMessages.id, messageId), eq(supportTickets.userId, userId)))
    .limit(1);

  const row = rows[0]?.message;
  if (!row) throw new MessageNotFoundError();
  return row;
}

export type { SupportResponsibility };