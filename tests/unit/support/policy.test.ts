import { describe, expect, it } from 'vitest';
import {
  canCustomerReply,
  canCustomerClose,
  canCustomerConfirmResolution,
  canCustomerReopen,
  statusAfterCustomerReply,
  isTicketOwner,
  selectCustomerVisibleMessages,
  selectStaffVisibleMessages,
  requiresManagedSupportEntitlement,
  isCustomerCreatableOrigin,
  countActiveTickets,
  exceedsOpenTicketLimit,
  defaultResponsibilityFor,
  serviceSlugForCategory,
  isServiceAffectingPriority,
} from '@/lib/support/policy';

describe('customer capability rules', () => {
  it('allows replies only while work is active', () => {
    expect(canCustomerReply('open')).toBe(true);
    expect(canCustomerReply('in_progress')).toBe(true);
    expect(canCustomerReply('waiting_for_customer')).toBe(true);
    expect(canCustomerReply('resolved')).toBe(false);
    expect(canCustomerReply('closed')).toBe(false);
    expect(canCustomerReply('nonsense')).toBe(false);
  });

  it('allows closing any actively worked ticket', () => {
    expect(canCustomerClose('open')).toBe(true);
    expect(canCustomerClose('in_progress')).toBe(true);
    expect(canCustomerClose('waiting_for_customer')).toBe(true);
    expect(canCustomerClose('resolved')).toBe(false);
    expect(canCustomerClose('closed')).toBe(false);
  });

  it('allows confirming resolution only for resolved tickets', () => {
    expect(canCustomerConfirmResolution('resolved')).toBe(true);
    expect(canCustomerConfirmResolution('open')).toBe(false);
    expect(canCustomerConfirmResolution('closed')).toBe(false);
  });

  it('allows reopening resolved or closed tickets', () => {
    expect(canCustomerReopen('resolved')).toBe(true);
    expect(canCustomerReopen('closed')).toBe(true);
    expect(canCustomerReopen('open')).toBe(false);
    expect(canCustomerReopen('in_progress')).toBe(false);
  });
});

describe('statusAfterCustomerReply', () => {
  it('requeues tickets waiting for the customer', () => {
    expect(statusAfterCustomerReply('waiting_for_customer')).toBe('in_progress');
  });

  it('keeps the status for other active tickets', () => {
    expect(statusAfterCustomerReply('open')).toBeNull();
    expect(statusAfterCustomerReply('in_progress')).toBeNull();
  });

  it('returns null for non-replyable tickets', () => {
    expect(statusAfterCustomerReply('resolved')).toBeNull();
    expect(statusAfterCustomerReply('closed')).toBeNull();
  });
});

describe('isTicketOwner', () => {
  it('matches only the owning account', () => {
    expect(isTicketOwner('u1', 'u1')).toBe(true);
    expect(isTicketOwner('u1', 'u2')).toBe(false);
  });

  it('rejects a missing actor', () => {
    expect(isTicketOwner('u1', null)).toBe(false);
  });
});

describe('message visibility filters', () => {
  const messages = [
    { id: '1', isInternal: false },
    { id: '2', isInternal: true },
    { id: '3', isInternal: false },
  ];

  it('strips internal notes for customers', () => {
    const visible = selectCustomerVisibleMessages(messages);
    expect(visible.map((message) => message.id)).toEqual(['1', '3']);
  });

  it('keeps internal notes for staff', () => {
    expect(selectStaffVisibleMessages(messages)).toHaveLength(3);
  });
});

describe('origin policy', () => {
  it('requires a Managed Support entitlement for every customer ticket', () => {
    expect(requiresManagedSupportEntitlement('managed_support')).toBe(true);
  });

  it('accepts only the Managed Support origin from the customer API', () => {
    expect(isCustomerCreatableOrigin('managed_support')).toBe(true);
    expect(isCustomerCreatableOrigin('public_request')).toBe(false);
    expect(isCustomerCreatableOrigin('internal')).toBe(false);
  });
});

describe('open ticket limits', () => {
  it('counts only active statuses', () => {
    expect(
      countActiveTickets(['open', 'resolved', 'closed', 'in_progress', 'waiting_for_customer'])
    ).toBe(3);
  });

  it('treats a null limit as unlimited', () => {
    expect(exceedsOpenTicketLimit(1000, null)).toBe(false);
  });

  it('blocks when the active count reaches the limit', () => {
    expect(exceedsOpenTicketLimit(5, 5)).toBe(true);
    expect(exceedsOpenTicketLimit(4, 5)).toBe(false);
  });

  it('treats a zero limit as no queue at all', () => {
    expect(exceedsOpenTicketLimit(0, 0)).toBe(true);
  });
});

describe('classification defaults', () => {
  it('maps managed-service categories to Ravelyth Managed Support', () => {
    for (const category of ['dns', 'email', 'website', 'ssl_tls', 'domain', 'hosting']) {
      expect(defaultResponsibilityFor(category)).toBe('ravelyth_managed_support');
    }
  });

  it('leaves everything else unassigned for staff triage', () => {
    expect(defaultResponsibilityFor('security')).toBe('unassigned');
    expect(defaultResponsibilityFor('other')).toBe('unassigned');
  });

  it('maps categories to service catalogue slugs', () => {
    expect(serviceSlugForCategory('dns')).toBe('dns-management');
    expect(serviceSlugForCategory('email')).toBe('email-management');
    expect(serviceSlugForCategory('hosting')).toBe('vps-management');
    expect(serviceSlugForCategory('security')).toBeNull();
  });

  it('reserves high priority for service-affecting problems', () => {
    expect(isServiceAffectingPriority('high')).toBe(true);
    expect(isServiceAffectingPriority('normal')).toBe(false);
  });
});
