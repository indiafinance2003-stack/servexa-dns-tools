import { eq, desc, and, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { dbFromRequest } from '@/lib/db/request';
import { supportTickets, supportMessages, type SupportTicketRow, type SupportMessageRow } from '@/lib/db/schema';
import { authenticatedRequest } from '@/lib/auth/api';

export class SupportError extends Error {
  constructor(message: string, public code: string, public status = 400) {
    super(message);
    this.name = 'SupportError';
  }
}

export class TicketNotFoundError extends SupportError {
  constructor() {
    super('The requested support ticket was not found.', 'TICKET_NOT_FOUND', 404);
  }
}

export class UnauthorizedTicketAccessError extends SupportError {
  constructor() {
    super('You do not have access to that support ticket.', 'UNAUTHORIZED_TICKET_ACCESS', 403);
  }
}

export class MessageNotFoundError extends SupportError {
  constructor() {
    super('The requested message was not found.', 'MESSAGE_NOT_FOUND', 404);
  }
}

export class UnauthorizedMessageAccessError extends SupportError {
  constructor() {
    super('You do not have access to that message.', 'UNAUTHORIZED_MESSAGE_ACCESS', 403);
  }
}

export class InvalidTicketStateError extends SupportError {
  constructor(message = "That action is not allowed in the ticket's current state.") {
    super(message, 'INVALID_TICKET_STATE', 409);
  }
}

export function isInternalNote(body: string): boolean {
  const cleaned = body.trimStart();
  return cleaned.startsWith('//') || cleaned.startsWith('#') || cleaned.startsWith('INTERNAL:');
}

export function stripInternalNoteMarker(body: string): string {
  return body.replace(/^(?:\/\/|#|INTERNAL:\s*)/, '').trimStart();
}

export function sanitizeTicketSummary(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function ticketReferenceLabel(reference: string): string {
  return reference.toUpperCase();
}

export type CreateTicketInput = {
  subject: string;
  description: string;
  category: string;
  priority: string;
  affectedDomain?: string | null;
  relatedTool?: string | null;
};

export type AddMessageInput = {
  body: string;
  internal?: boolean;
  relatedTicketId?: string | null;
};

export type TicketListItem = {
  id: string;
  reference: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
  latestMessageAt: Date | null;
  latestVisibleMessagePreview: string | null;
};

export type TicketDetail = {
  ticket: SupportTicketRow;
  messages: SupportMessageRow[];
  canCustomerReply: boolean;
  canCustomerClose: boolean;
  canCustomerConfirmResolution: boolean;
};

export async function listMyTickets(limit = 50, offset = 0): Promise<TicketListItem[]> {
  const { user } = await authenticatedRequest();
  if (!user) throw new SupportError('Authentication required.', 'AUTH_REQUIRED', 401);

  const { db } = dbFromRequest();
  const rows = await db
    .select({
      id: supportTickets.id,
      reference: supportTickets.reference,
      subject: supportTickets.subject,
      category: supportTickets.category,
      priority: supportTickets.priority,
      status: supportTickets.status,
      createdAt: supportTickets.createdAt,
      updatedAt: supportTickets.updatedAt,
            messageCount: count(supportMessages.id),
      latestMessageAt: supportMessages.createdAt,
      latestVisibleMessagePreview: supportMessages.body,
    })
    .from(supportTickets)
    .leftJoin(
      supportMessages,
      and(
        eq(supportMessages.ticketId, supportTickets.id),
        eq(supportMessages.isInternal, false)
      )
    )
    .where(eq(supportTickets.userId, user.id))
    .orderBy(desc(supportTickets.updatedAt), desc(supportTickets.createdAt))
    .limit(limit)
    .offset(offset);

  const grouped = new Map<string, TicketListItem>();
  for (const row of rows) {
    const existing = grouped.get(row.id);
    if (!existing) {
      grouped.set(row.id, {
        id: row.id,
        reference: row.reference,
        subject: row.subject,
        category: row.category,
        priority: row.priority,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        messageCount: row.messageCount,
        latestMessageAt: row.latestMessageAt,
        latestVisibleMessagePreview: row.latestVisibleMessagePreview
          ? sanitizeTicketSummary(row.latestVisibleMessagePreview).slice(0, 160)
          : null,
      });
    } else if (row.latestMessageAt && (!existing.latestMessageAt || row.latestMessageAt > existing.latestMessageAt)) {
      existing.latestMessageAt = row.latestMessageAt;
      existing.latestVisibleMessagePreview = row.latestVisibleMessagePreview
        ? sanitizeTicketSummary(row.latestVisibleMessagePreview).slice(0, 160)
        : null;
      existing.messageCount = row.messageCount;
    }
  }

  return Array.from(grouped.values());
}

export async function getMyTicket(ticketId: string): Promise<TicketDetail> {
  const { user } = await authenticatedRequest();
  if (!user) throw new SupportError('Authentication required.', 'AUTH_REQUIRED', 401);

  const { db } = dbFromRequest();
  const ticket = await db.query.supportTickets.findFirst({
    where: and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, user.id)),
  });

  if (!ticket) throw new TicketNotFoundError();

        const messages = await db.query.supportMessages.findMany({
    where: eq(supportMessages.ticketId, ticketId),
    orderBy: [supportMessages.createdAt],
  });

  const openStatuses = ['open', 'in_progress', 'waiting_for_customer'];

  return {
    ticket,
    messages,
    canCustomerReply: openStatuses.includes(ticket.status),
    canCustomerClose: ticket.status === 'open' || ticket.status === 'in_progress',
    canCustomerConfirmResolution: ticket.status === 'resolved',
  };
}

export async function createTicket(input: CreateTicketInput): Promise<SupportTicketRow> {
  const { user } = await authenticatedRequest();
  if (!user) throw new SupportError('Authentication required.', 'AUTH_REQUIRED', 401);

  if (!input.subject || input.subject.trim().length === 0) {
    throw new SupportError('Subject is required.', 'INVALID_INPUT', 400);
  }
  if (!input.description || input.description.trim().length === 0) {
    throw new SupportError('Description is required.', 'INVALID_INPUT', 400);
  }

    const { db } = dbFromRequest();
  const reference = `RT-${nanoid(10)}`;
  const ticket = await db
    .insert(supportTickets)
    .values({
      userId: user.id,
      reference,
      subject: input.subject.trim(),
      description: input.description.trim(),
      category: input.category,
      priority: input.priority,
      affectedDomain: input.affectedDomain ?? null,
      relatedTool: input.relatedTool ?? null,
    })
    .returning();

  await db.insert(supportMessages).values({
        ticketId: ticket[0].id,
    authorRole: 'customer',
    body: input.description.trim(),
    isInternal: false,
  });

    return ticket[0];
}

export async function addReply(ticketId: string, input: AddMessageInput): Promise<SupportMessageRow> {
  const { user } = await authenticatedRequest();
  if (!user) throw new SupportError('Authentication required.', 'AUTH_REQUIRED', 401);

  const { db } = dbFromRequest();
  const ticket = await db.query.supportTickets.findFirst({
    where: and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, user.id)),
  });

  if (!ticket) throw new TicketNotFoundError();

  const openStatuses = ['open', 'in_progress', 'waiting_for_customer'];
  if (!openStatuses.includes(ticket.status)) {
    throw new InvalidTicketStateError(
      'Replies are only allowed while the ticket is open, in progress, or waiting for customer.'
    );
  }

  const body = input.body.trim();
  if (!body) {
    throw new SupportError('Message body is required.', 'INVALID_INPUT', 400);
  }

    const message = await db
    .insert(supportMessages)
    .values({
      ticketId,
      authorRole: 'customer',
      body,
      isInternal: false,
    })
    .returning();

  await db
    .update(supportTickets)
    .set({ updatedAt: new Date() })
    .where(eq(supportTickets.id, ticketId));

    return message[0];
}

export async function closeTicket(ticketId: string): Promise<SupportTicketRow> {
  const { user } = await authenticatedRequest();
  if (!user) throw new SupportError('Authentication required.', 'AUTH_REQUIRED', 401);

  const { db } = dbFromRequest();
  const ticket = await db.query.supportTickets.findFirst({
    where: and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, user.id)),
  });

  if (!ticket) throw new TicketNotFoundError();

  if (ticket.status !== 'open' && ticket.status !== 'in_progress') {
    throw new InvalidTicketStateError('Only open or in-progress tickets can be closed by the customer.');
  }

  const updated = await db
    .update(supportTickets)
    .set({ status: 'closed', updatedAt: new Date() })
    .where(eq(supportTickets.id, ticketId))
    .returning();

  return updated[0];
}

export async function confirmResolution(ticketId: string): Promise<SupportTicketRow> {
  const { user } = await authenticatedRequest();
  if (!user) throw new SupportError('Authentication required.', 'AUTH_REQUIRED', 401);

  const { db } = dbFromRequest();
  const ticket = await db.query.supportTickets.findFirst({
    where: and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, user.id)),
  });

  if (!ticket) throw new TicketNotFoundError();

  if (ticket.status !== 'resolved') {
    throw new InvalidTicketStateError('Only resolved tickets can be confirmed by the customer.');
  }

  const updated = await db
    .update(supportTickets)
    .set({ status: 'closed', updatedAt: new Date() })
    .where(eq(supportTickets.id, ticketId))
    .returning();

  return updated[0];
}

export async function getTicketMessages(ticketId: string): Promise<SupportMessageRow[]> {
  const { user } = await authenticatedRequest();
  if (!user) throw new SupportError('Authentication required.', 'AUTH_REQUIRED', 401);

  const { db } = dbFromRequest();
  const ticket = await db.query.supportTickets.findFirst({
    where: and(eq(supportTickets.id, ticketId), eq(supportTickets.userId, user.id)),
  });

  if (!ticket) throw new TicketNotFoundError();

  const rows = await db.query.supportMessages.findMany({
    where: eq(supportMessages.ticketId, ticketId),
    orderBy: [supportMessages.createdAt],
  });

  // Internal notes are never returned to customers via the customer API.
  return rows.filter((message) => !message.isInternal);
}