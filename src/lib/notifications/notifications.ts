import { and, desc, eq, sql } from 'drizzle-orm';
import { dbFromRequest } from '@/lib/db/request';
import {
  notifications,
  NOTIFICATION_TYPES,
  type NotificationRow,
  type NotificationType,
} from '@/lib/db/schema';
import { isEmailDeliveryConfigured, sanitizeNotificationLink } from './catalog';

/**
 * Customer notifications.
 *
 * Every function takes the user id as its first argument and the caller MUST
 * resolve it from the authenticated session. All reads and writes are scoped by
 * `user_id`, so a notification can never be listed, read or marked by another
 * account (tenant isolation).
 *
 * Notifications are in-app records only. Transactional email is a future
 * channel: `isEmailDeliveryConfigured()` is false until a provider is
 * configured, and nothing in the UI claims an email was sent.
 */

export class NotificationError extends Error {
  constructor(
    message: string,
    public code: string,
    public status = 400
  ) {
    super(message);
    this.name = 'NotificationError';
  }
}

export interface NotificationDTO {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}

const MAX_TITLE = 140;
const MAX_BODY = 600;

function toDTO(row: NotificationRow): NotificationDTO {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: sanitizeNotificationLink(row.link),
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

function assertNotificationType(type: string): asserts type is NotificationType {
  if (!(NOTIFICATION_TYPES as readonly string[]).includes(type)) {
    throw new NotificationError('Unsupported notification type.', 'INVALID_NOTIFICATION_TYPE', 400);
  }
}

function cleanText(value: string, max: number, field: string): string {
  const cleaned = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  if (cleaned.length === 0) {
    throw new NotificationError(`Notification ${field} is required.`, 'INVALID_NOTIFICATION', 400);
  }
  return cleaned;
}

/**
 * Creates an in-app notification for a specific customer.
 *
 * Used by support/billing flows after a real database change has happened — it
 * is never used to announce something that did not occur.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<NotificationDTO> {
  assertNotificationType(input.type);
  const { db } = dbFromRequest();
  const rows = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: cleanText(input.title, MAX_TITLE, 'title'),
      body: cleanText(input.body, MAX_BODY, 'body'),
      link: sanitizeNotificationLink(input.link ?? null),
    })
    .returning();
  return toDTO(rows[0]);
}

/**
 * Best-effort variant for flows where a notification is secondary to the main
 * action (for example a support reply). A notification failure must never roll
 * back or fail the primary operation.
 */
export async function safeCreateNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await createNotification(input);
  } catch {
    // Intentionally swallowed: notification creation is not transactional with
    // the business operation and must not surface as an API error.
  }
}

export interface ListNotificationsOptions {
  limit?: number;
  unreadOnly?: boolean;
}

/** Lists notifications for one customer, newest first. */
export async function listNotifications(
  userId: string,
  options: ListNotificationsOptions = {}
): Promise<NotificationDTO[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const { db } = dbFromRequest();
  const where = options.unreadOnly
    ? and(eq(notifications.userId, userId), eq(notifications.read, false))
    : eq(notifications.userId, userId);

  const rows = await db
    .select()
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return rows.map(toDTO);
}

/** Unread count for the portal badge. */
export async function countUnreadNotifications(userId: string): Promise<number> {
  const { db } = dbFromRequest();
  const rows = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return rows[0]?.value ?? 0;
}

/**
 * Marks a single notification as read. The update is scoped to the owner, so a
 * guessed notification id belonging to another account matches zero rows and
 * the caller is told the notification was not found.
 */
export async function markNotificationRead(
  userId: string,
  notificationId: string
): Promise<NotificationDTO> {
  const { db } = dbFromRequest();
  const rows = await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning();

  if (rows.length === 0) {
    throw new NotificationError(
      'The requested notification was not found.',
      'NOTIFICATION_NOT_FOUND',
      404
    );
  }
  return toDTO(rows[0]);
}

/** Marks every unread notification for one customer as read. */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const { db } = dbFromRequest();
  const rows = await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
    .returning({ id: notifications.id });
  return rows.length;
}

/** Delivery capability summary, surfaced honestly in the portal. */
export function notificationDeliveryStatus(): {
  inApp: boolean;
  email: boolean;
} {
  return {
    inApp: true,
    email: isEmailDeliveryConfigured(),
  };
}