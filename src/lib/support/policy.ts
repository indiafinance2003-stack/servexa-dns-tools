import {
  ACTIVE_SUPPORT_STATUSES,
  CATEGORY_SERVICE_SLUG,
  type SupportCategory,
  type SupportResponsibility,
  type SupportStatus,
} from './catalog';
import type { SupportMessageRow } from '@/lib/db/schema';

/**
 * Pure support policy rules.
 *
 * No database, auth or request imports: every rule here is a deterministic
 * function of its arguments so security-sensitive behaviour (ownership,
 * internal-note isolation, lifecycle transitions, entitlement) can be unit
 * tested without a live PostgreSQL instance.
 */

export interface SupportMessageView {
  id: string;
  authorRole: string;
  body: string;
  isInternal: boolean;
  createdAt: Date;
  authorUserId: string | null;
}

/** Customer-initiated reply is only possible while work is still active. */
export function canCustomerReply(status: string): boolean {
  return (ACTIVE_SUPPORT_STATUSES as readonly string[]).includes(status);
}

/** A customer may close a ticket that is still being worked on, including one
 * that is waiting on information from them. */
export function canCustomerClose(status: string): boolean {
  return status === 'open' || status === 'in_progress' || status === 'waiting_for_customer';
}

/** A customer may confirm (or reopen) a ticket that staff resolved. */
export function canCustomerConfirmResolution(status: string): boolean {
  return status === 'resolved';
}

/**
 * Reopen rule: a resolved or closed ticket can be reopened by its owner, which
 * returns it to the staff queue as 'open'. This is how a customer reports that
 * the problem came back.
 */
export function canCustomerReopen(status: string): boolean {
  return status === 'resolved' || status === 'closed';
}

/**
 * Status a ticket moves to when the customer replies. A reply on a ticket that
 * is waiting for the customer puts it back in progress so it re-enters the
 * staff queue instead of sitting in the waiting column.
 */
export function statusAfterCustomerReply(status: string): SupportStatus | null {
  if (!canCustomerReply(status)) return null;
  if (status === 'waiting_for_customer') return 'in_progress';
  return null;
}

/**
 * Ownership check. Ticket identity and actor identity are both resolved
 * server-side; a mismatch is treated as "not found" (404) by the service layer
 * so the API never confirms that another customer's ticket exists.
 */
export function isTicketOwner(ticketUserId: string, actorUserId: string | null): boolean {
  if (!actorUserId) return false;
  return ticketUserId === actorUserId;
}

/**
 * Only Managed Support tickets (created against a verified entitlement) and
 * staff-authored notes carry internal content. Public requests never expose
 * internal notes either — the filter below is applied for every reader.
 */
export function selectCustomerVisibleMessages<T extends { isInternal: boolean }>(
  messages: T[]
): T[] {
  return messages.filter((message) => message.isInternal === false);
}

/** Admin-room view: staff with support permission see internal notes too. */
export function selectStaffVisibleMessages<T extends { isInternal: boolean }>(
  messages: T[]
): T[] {
  return messages;
}

/**
 * Entitlement requirement per ticket origin. Only Managed Support tickets
 * consume (and require) a Managed Support entitlement; the general public
 * request flow exists precisely so an account without a plan can still ask.
 */
export function requiresManagedSupportEntitlement(origin: string): boolean {
  return origin === 'managed_support';
}

/** Whether an origin is allowed to be created through the customer-facing API. */
export function isCustomerCreatableOrigin(origin: string): boolean {
  return origin === 'managed_support';
}

/** Number of active (non-terminal) tickets, used for plan limits. */
export function countActiveTickets(statuses: string[]): number {
  return statuses.filter((status) =>
    (ACTIVE_SUPPORT_STATUSES as readonly string[]).includes(status)
  ).length;
}

/**
 * Open-ticket limit check. A null limit means "not limited"; a limit of 0 means
 * the plan includes no ticket queue at all.
 */
export function exceedsOpenTicketLimit(activeCount: number, limit: number | null): boolean {
  if (limit === null) return false;
  return activeCount >= limit;
}

/**
 * Default responsibility classification for a category. Ravelyth is assumed
 * responsible for the managed-support areas; everything else starts as
 * 'unassigned' and is triaged by staff in the admin room.
 */
export function defaultResponsibilityFor(category: string): SupportResponsibility {
  switch (category) {
    case 'dns':
    case 'email':
    case 'website':
    case 'ssl_tls':
    case 'domain':
    case 'hosting':
      return 'ravelyth_managed_support';
    default:
      return 'unassigned';
  }
}

/** Service catalogue slug for a support category (null when not applicable). */
export function serviceSlugForCategory(category: string): string | null {
  return CATEGORY_SERVICE_SLUG[category as SupportCategory] ?? null;
}

/**
 * Priority guidance: 'high' is reserved for service-affecting problems
 * (site down, mail down, security). Customers can select it, and staff may
 * downgrade it during triage.
 */
export function isServiceAffectingPriority(priority: string): boolean {
  return priority === 'high';
}

/** Re-exported row type keeps callers from importing the schema directly. */
export type SupportMessage = SupportMessageRow;

/** Maps rows to the safe view shape returned by the customer API. */
export function toMessageView(row: SupportMessageRow): SupportMessageView {
  return {
    id: row.id,
    authorRole: row.authorRole,
    body: row.body,
    isInternal: row.isInternal,
    createdAt: row.createdAt,
    authorUserId: row.authorUserId,
  };
}