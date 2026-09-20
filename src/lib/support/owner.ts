import 'server-only';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { dbFromRequest } from '@/lib/db/request';
import {
  supportMessages,
  supportTickets,
  users,
  type SupportTicketRow,
} from '@/lib/db/schema';
import { recordAudit } from '@/lib/control/audit';
import {
  SUPPORT_STATUS_TRANSITIONS,
  canTransitionStatus,
  isSupportStatus,
  statusLabel,
} from './catalog';
import { InvalidTicketStateError, TicketNotFoundError } from './errors';
import { safeCreateNotification } from '@/lib/notifications/notifications';

/**
 * Owner-side support operations.
 *
 * Every function here is called only from Owner-authenticated routes/pages —
 * but each mutation independently re-verifies the ticket exists and writes an
 * audit event, so a stolen session cannot act silently. Internal notes live in
 * `support_messages.is_internal` and are NEVER returned by the customer service.
 */

export interface OwnerTicketSummary {
  id: string;
  reference: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  origin: string;
  responsibility: string;
  affectedDomain: string | null;
  customerEmail: string;
  customerName: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
}

export interface OwnerTicketMessage {
  id: string;
  authorRole: string;
  authorEmail: string | null;
  body: string;
  isInternal: boolean;
  internalNote: string | null;
  createdAt: string;
}

export interface OwnerTicketDetail extends OwnerTicketSummary {
  description: string;
  context: Record<string, unknown> | null;
  messages: OwnerTicketMessage[];
  allowedNextStatuses: string[];
}

function toOwnerSummary(row: SupportTicketRow, customer: { email: string; name: string | null }): OwnerTicketSummary {
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
    customerEmail: customer.email,
    customerName: customer.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lastMessageAt: row.lastMessageAt ? row.lastMessageAt.toISOString() : null,
  };
}

export interface ListOwnerTicketsOptions {
  status?: string;
  origin?: string;
  priority?: string;
  query?: string;
  limit?: number;
}

/** Lists tickets across all customers (Owner only; filters are server-validated). */
export async function listAllTickets(options: ListOwnerTicketsOptions = {}): Promise<OwnerTicketSummary[]> {
  const { db } = dbFromRequest();
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
  const filters = [];
  if (options.status && isSupportStatus(options.status)) filters.push(eq(supportTickets.status, options.status));
  if (options.origin === 'managed_support' || options.origin === 'public_request') {
    filters.push(eq(supportTickets.origin, options.origin));
  }
  if (options.priority === 'low' || options.priority === 'normal' || options.priority === 'high') {
    filters.push(eq(supportTickets.priority, options.priority));
  }
  if (options.query) {
    const pattern = `%${options.query.replace(/[%_\\]/g, '')}%`;
    filters.push(
      or(
        ilike(supportTickets.reference, pattern),
        ilike(supportTickets.subject, pattern),
        ilike(users.email, pattern)
      )!
    );
  }

  const base = db
    .select({
      ticket: supportTickets,
      customerEmail: users.email,
      customerName: users.name,
    })
    .from(supportTickets)
    .innerJoin(users, eq(supportTickets.userId, users.id));

  const rows = filters.length
    ? await base.where(and(...filters)).orderBy(desc(supportTickets.lastMessageAt)).limit(limit)
    : await base.orderBy(desc(supportTickets.lastMessageAt)).limit(limit);

  return rows.map((r) => toOwnerSummary(r.ticket, { email: r.customerEmail, name: r.customerName }));
}

async function requireTicket(ticketId: string): Promise<SupportTicketRow> {
  const { db } = dbFromRequest();
  const rows = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  if (!rows[0]) throw new TicketNotFoundError();
  return rows[0];
}

/** Full ticket for the Owner view — internal messages included. */
export async function getOwnerTicket(ticketId: string): Promise<OwnerTicketDetail> {
  const { db } = dbFromRequest();
  const ticket = await requireTicket(ticketId);
  const customerRows = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, ticket.userId))
    .limit(1);
  const customer = customerRows[0] ?? { email: 'unknown', name: null };
  const messages = await db
    .select({ message: supportMessages, authorEmail: users.email })
    .from(supportMessages)
    .leftJoin(users, eq(supportMessages.authorUserId, users.id))
    .where(eq(supportMessages.ticketId, ticketId))
    .orderBy(supportMessages.createdAt);
  return {
    ...toOwnerSummary(ticket, customer),
    description: ticket.description,
    context: (ticket.contextJson as Record<string, unknown> | null) ?? null,
    messages: messages.map((m) => ({
      id: m.message.id,
      authorRole: m.message.authorRole,
      authorEmail: m.authorEmail,
      body: m.message.body,
      isInternal: m.message.isInternal,
      internalNote: m.message.internalNote,
      createdAt: m.message.createdAt.toISOString(),
    })),
    allowedNextStatuses: isSupportStatus(ticket.status) ? SUPPORT_STATUS_TRANSITIONS[ticket.status] : [],
  };
}

/** Adds a private internal note. Never visible to the customer. */
export async function addInternalNote(
  actorUserId: string,
  ticketId: string,
  note: string
): Promise<void> {
  const trimmed = note.trim().slice(0, 8000);
  if (!trimmed) throw new InvalidTicketStateError('Internal note must not be empty.');
  const ticket = await requireTicket(ticketId);
  const { db } = dbFromRequest();
  await db.insert(supportMessages).values({
    ticketId,
    authorUserId: actorUserId,
    authorRole: 'staff',
    body: trimmed,
    isInternal: true,
  });
  await recordAudit(actorUserId, {
    action: 'admin_action',
    description: `Internal note added to ticket ${ticket.reference}`,
    metadata: { ticketId, area: 'support' },
  });
}

/** Posts a customer-visible staff reply and notifies the customer. */
export async function postOwnerReply(
  actorUserId: string,
  ticketId: string,
  body: string,
  options: { setWaiting?: boolean } = {}
): Promise<void> {
  const trimmed = body.trim().slice(0, 8000);
  if (!trimmed) throw new InvalidTicketStateError('Reply must not be empty.');
  const { db } = dbFromRequest();
  const ticket = await requireTicket(ticketId);
  await db.insert(supportMessages).values({
    ticketId,
    authorUserId: actorUserId,
    authorRole: 'staff',
    body: trimmed,
    isInternal: false,
  });
  const patch: Partial<SupportTicketRow> = { lastMessageAt: new Date(), updatedAt: new Date() };
  // Staff reply usually hands the ball back to the customer, unless the reply
  // itself resolves the ticket (then the caller sets the status explicitly).
  if (options.setWaiting !== false && ticket.status === 'in_progress') {
    patch.status = 'waiting_for_customer';
  }
  await db.update(supportTickets).set(patch).where(eq(supportTickets.id, ticketId));
  await safeCreateNotification({
    userId: ticket.userId,
    type: 'ticket_reply',
    title: `Support replied to ${ticket.reference}`,
    body: trimmed.slice(0, 160),
    link: `/account/support/${ticket.id}`,
  });
  await recordAudit(actorUserId, {
    action: 'admin_action',
    description: `Staff reply posted on ticket ${ticket.reference}`,
    metadata: { ticketId, area: 'support' },
  });
}

/** Moves a ticket through the staff-side status lifecycle. */
export async function setOwnerTicketStatus(
  actorUserId: string,
  ticketId: string,
  status: string
): Promise<void> {
  const ticket = await requireTicket(ticketId);
  if (!isSupportStatus(status)) throw new InvalidTicketStateError(`Unknown status: ${status}`);
  if (!canTransitionStatus(ticket.status, status)) {
    throw new InvalidTicketStateError(
      `Cannot move ticket from ${statusLabel(ticket.status)} to ${statusLabel(status)}.`
    );
  }
  const { db } = dbFromRequest();
  const patch: Partial<SupportTicketRow> = { status, updatedAt: new Date() };
  if (status === 'resolved') patch.resolvedAt = new Date();
  if (status === 'closed') patch.closedAt = new Date();
  await db.update(supportTickets).set(patch).where(eq(supportTickets.id, ticketId));
  await safeCreateNotification({
    userId: ticket.userId,
    type: 'ticket_status_changed',
    title: `Ticket ${ticket.reference} is now ${statusLabel(status)}`,
    body: ticket.subject,
    link: `/account/support/${ticket.id}`,
  });
  await recordAudit(actorUserId, {
    action: 'admin_action',
    description: `Ticket ${ticket.reference} status: ${ticket.status} → ${status}`,
    metadata: { ticketId, from: ticket.status, to: status, area: 'support' },
  });
}

/** Updates ticket priority (staff triage). */
export async function setOwnerTicketPriority(
  actorUserId: string,
  ticketId: string,
  priority: string
): Promise<void> {
  if (priority !== 'low' && priority !== 'normal' && priority !== 'high') {
    throw new InvalidTicketStateError(`Unknown priority: ${priority}`);
  }
  const ticket = await requireTicket(ticketId);
  const { db } = dbFromRequest();
  await db
    .update(supportTickets)
    .set({ priority, updatedAt: new Date() })
    .where(eq(supportTickets.id, ticketId));
  await recordAudit(actorUserId, {
    action: 'admin_action',
    description: `Ticket ${ticket.reference} priority set to ${priority}`,
    metadata: { ticketId, priority, area: 'support' },
  });
}

export interface SupportQueueCounts {
  open: number;
  inProgress: number;
  waiting: number;
  resolved: number;
  closed: number;
  high: number;
  total: number;
}

/** Real counts for the Owner support dashboard. */
export async function supportQueueCounts(): Promise<SupportQueueCounts> {
  const { db } = dbFromRequest();
  const rows = await db
    .select({ status: supportTickets.status, priority: supportTickets.priority })
    .from(supportTickets);
  const counts: SupportQueueCounts = { open: 0, inProgress: 0, waiting: 0, resolved: 0, closed: 0, high: 0, total: rows.length };
  for (const row of rows) {
    if (row.status === 'open') counts.open += 1;
    else if (row.status === 'in_progress') counts.inProgress += 1;
    else if (row.status === 'waiting_for_customer') counts.waiting += 1;
    else if (row.status === 'resolved') counts.resolved += 1;
    else if (row.status === 'closed') counts.closed += 1;
    if (row.priority === 'high' && row.status !== 'closed') counts.high += 1;
  }
  return counts;
}
