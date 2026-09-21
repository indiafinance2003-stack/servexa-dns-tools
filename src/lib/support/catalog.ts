import {
  SUPPORT_CATEGORIES,
  SUPPORT_MESSAGE_AUTHOR_ROLES,
  SUPPORT_ORIGINS,
  SUPPORT_PRIORITIES,
  SUPPORT_RESPONSIBILITIES,
  SUPPORT_STATUSES,
  type SupportCategory,
  type SupportMessageAuthorRole,
  type SupportOrigin,
  type SupportPriority,
  type SupportResponsibility,
  type SupportStatus,
} from '@/lib/db/schema';

/**
 * Presentation-independent support vocabulary.
 *
 * Stored values live in `src/lib/db/schema.ts` (single source of truth for the
 * database enums) and are re-exported here together with labels, ordering,
 * lifecycle rules and responsibility classification used by both the customer
 * portal and the internal admin room.
 */

export {
  SUPPORT_CATEGORIES,
  SUPPORT_MESSAGE_AUTHOR_ROLES,
  SUPPORT_ORIGINS,
  SUPPORT_PRIORITIES,
  SUPPORT_RESPONSIBILITIES,
  SUPPORT_STATUSES,
  type SupportCategory,
  type SupportMessageAuthorRole,
  type SupportOrigin,
  type SupportPriority,
  type SupportResponsibility,
  type SupportStatus,
};

export const SUPPORT_CATEGORY_LABELS: Record<SupportCategory, string> = {
  dns: 'DNS',
  email: 'Email',
  website: 'Website / WordPress',
  ssl_tls: 'SSL / TLS',
  domain: 'Domain / nameservers',
  hosting: 'Hosting / VPS',
  security: 'Security',
  other: 'Other',
};

export const SUPPORT_PRIORITY_LABELS: Record<SupportPriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
};

export const SUPPORT_PRIORITY_ORDER: Record<SupportPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

export const SUPPORT_STATUS_LABELS: Record<SupportStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_for_customer: 'Waiting for customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const SUPPORT_RESPONSIBILITY_LABELS: Record<SupportResponsibility, string> = {
  unassigned: 'Not yet classified',
  ravelyth_control: 'Ravelyth Control',
  ravelyth_managed_support: 'Ravelyth Managed Support',
  hosting_provider: 'Hosting provider infrastructure',
  customer_application: 'Customer application',
  dns_provider: 'DNS / domain provider',
  email_provider: 'Email provider',
  third_party: 'Third-party service',
};

export const SUPPORT_ORIGIN_LABELS: Record<SupportOrigin, string> = {
  managed_support: 'Managed Support',
};

/**
 * Allowed status transitions. Customer-initiated transitions are a strict
 * subset of the staff transitions (see the `canCustomer*` helpers below).
 */
export const SUPPORT_STATUS_TRANSITIONS: Record<SupportStatus, SupportStatus[]> = {
  open: ['in_progress', 'waiting_for_customer', 'resolved', 'closed'],
  in_progress: ['waiting_for_customer', 'resolved', 'closed'],
  waiting_for_customer: ['in_progress', 'resolved', 'closed'],
  resolved: ['closed', 'in_progress'],
  closed: [],
};

export function isSupportCategory(value: string): value is SupportCategory {
  return (SUPPORT_CATEGORIES as readonly string[]).includes(value);
}

export function isSupportPriority(value: string): value is SupportPriority {
  return (SUPPORT_PRIORITIES as readonly string[]).includes(value);
}

export function isSupportStatus(value: string): value is SupportStatus {
  return (SUPPORT_STATUSES as readonly string[]).includes(value);
}

export function isSupportResponsibility(value: string): value is SupportResponsibility {
  return (SUPPORT_RESPONSIBILITIES as readonly string[]).includes(value);
}

export function isSupportOrigin(value: string): value is SupportOrigin {
  return (SUPPORT_ORIGINS as readonly string[]).includes(value);
}

export function canTransitionStatus(from: string, to: string): boolean {
  if (!isSupportStatus(from) || !isSupportStatus(to)) return false;
  return SUPPORT_STATUS_TRANSITIONS[from].includes(to);
}

export function categoryLabel(value: string): string {
  return isSupportCategory(value) ? SUPPORT_CATEGORY_LABELS[value] : value;
}

export function priorityLabel(value: string): string {
  return isSupportPriority(value) ? SUPPORT_PRIORITY_LABELS[value] : value;
}

export function statusLabel(value: string): string {
  return isSupportStatus(value) ? SUPPORT_STATUS_LABELS[value] : value;
}

export function responsibilityLabel(value: string): string {
  return isSupportResponsibility(value) ? SUPPORT_RESPONSIBILITY_LABELS[value] : value;
}

export function originLabel(value: string): string {
  return isSupportOrigin(value) ? SUPPORT_ORIGIN_LABELS[value] : value;
}

/** Statuses considered "active work" for limits and metrics. */
export const ACTIVE_SUPPORT_STATUSES: SupportStatus[] = [
  'open',
  'in_progress',
  'waiting_for_customer',
];

export function isActiveSupportStatus(value: string): boolean {
  return (ACTIVE_SUPPORT_STATUSES as readonly string[]).includes(value);
}

export const SUPPORT_MESSAGE_AUTHOR_ROLE_LABELS: Record<SupportMessageAuthorRole, string> = {
  customer: 'Customer',
  staff: 'Ravelyth Support',
  system: 'System',
};

export function authorRoleLabel(value: string): string {
  return (SUPPORT_MESSAGE_AUTHOR_ROLES as readonly string[]).includes(value)
    ? SUPPORT_MESSAGE_AUTHOR_ROLE_LABELS[value as SupportMessageAuthorRole]
    : value;
}

/**
 * Maps a free-form diagnostic tool identifier to the closest support category
 * so a request started from a tool lands in a sensible queue.
 */
export function categoryForTool(tool: string | null | undefined): SupportCategory {
  switch ((tool || '').trim().toLowerCase()) {
    case 'email_analyze':
    case 'email_headers':
    case 'dns_spf':
    case 'spf':
    case 'dns_dkim':
    case 'dkim':
    case 'dns_dmarc':
    case 'dmarc':
      return 'email';
    case 'dns_lookup':
    case 'dns_health':
    case 'dns_analyze':
    case 'dns_resolvers':
      return 'dns';
    case 'ptr':
    case 'dns_ptr':
      return 'hosting';
    default:
      return 'other';
  }
}

/**
 * Managed Support service slug a category belongs to, used to attach service
 * context to a ticket. `null` means "no specific service" (the ticket is
 * classified by staff during triage).
 */
export const CATEGORY_SERVICE_SLUG: Record<SupportCategory, string | null> = {
  dns: 'dns-management',
  email: 'email-management',
  website: 'wordpress-management',
  ssl_tls: 'ssl-management',
  domain: 'dns-management',
  hosting: 'vps-management',
  security: null,
  other: null,
};