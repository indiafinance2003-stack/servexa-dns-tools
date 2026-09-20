import { config } from '@/lib/config';

/** Delivery channels a notification may use. */
export const NOTIFICATION_CHANNELS = ['in_app', 'email'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/**
 * Future notification categories (Part 2 §4.11). Types in this list may be
 * created once the corresponding feature records exist in the database —
 * nothing here is ever generated from simulated data.
 */
export const NOTIFICATION_CATEGORY_GROUPS: Array<{
  group: string;
  types: string[];
  status: 'implemented' | 'foundation';
}> = [
  { group: 'Account', types: ['account'], status: 'implemented' },
  {
    group: 'Support',
    types: ['ticket_created', 'ticket_reply', 'ticket_status_changed'],
    status: 'implemented',
  },
  {
    group: 'Subscription',
    types: ['subscription_created', 'subscription_status_changed'],
    status: 'foundation',
  },
  { group: 'Billing', types: ['invoice_issued', 'invoice_paid'], status: 'foundation' },
  {
    group: 'Lifecycle (planned)',
    types: [
      'payment_confirmation',
      'payment_failure',
      'renewal_warning',
      'expiry_warning',
      'suspension',
      'security_event',
    ],
    status: 'foundation',
  },
];

/** Whether transactional email can actually be delivered right now. */
export function isEmailDeliveryConfigured(): boolean {
  return config.EMAIL_PROVIDER.length > 0 && config.EMAIL_FROM.length > 0;
}

/**
 * Notification links must be internal, relative paths. Anything else is
 * dropped so a stored link can never be used as an open redirect or to leak a
 * third-party URL into the customer portal.
 */
export function sanitizeNotificationLink(link: string | null | undefined): string | null {
  if (typeof link !== 'string') return null;
  const value = link.trim();
  if (value.length === 0 || value.length > 300) return null;
  if (!value.startsWith('/')) return null;
  // Reject protocol-relative URLs ('//evil.example') and path traversal.
  if (value.startsWith('//')) return null;
  if (value.includes('..')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\s]/.test(value)) return null;
  return value;
}