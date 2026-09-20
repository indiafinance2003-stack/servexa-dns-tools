import { describe, expect, it } from 'vitest';
import {
  ACTIVE_SUPPORT_STATUSES,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_ORIGINS,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_RESPONSIBILITIES,
  SUPPORT_RESPONSIBILITY_LABELS,
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
  SUPPORT_STATUS_TRANSITIONS,
  canTransitionStatus,
  categoryForTool,
  isActiveSupportStatus,
  CATEGORY_SERVICE_SLUG,
} from '@/lib/support/catalog';
import { SUPPORT_MESSAGE_AUTHOR_ROLES } from '@/lib/db/schema';

describe('support vocabulary completeness', () => {
  it('labels every category, priority, status, origin and responsibility', () => {
    for (const category of SUPPORT_CATEGORIES) {
      expect(SUPPORT_CATEGORY_LABELS[category]).toBeTruthy();
      expect(CATEGORY_SERVICE_SLUG[category] === null || typeof CATEGORY_SERVICE_SLUG[category] === 'string').toBe(true);
    }
    for (const priority of SUPPORT_PRIORITIES) {
      expect(SUPPORT_PRIORITY_LABELS[priority]).toBeTruthy();
    }
    for (const status of SUPPORT_STATUSES) {
      expect(SUPPORT_STATUS_LABELS[status]).toBeTruthy();
    }
    for (const origin of SUPPORT_ORIGINS) {
      expect(origin).toBeTruthy();
    }
    for (const responsibility of SUPPORT_RESPONSIBILITIES) {
      expect(SUPPORT_RESPONSIBILITY_LABELS[responsibility]).toBeTruthy();
    }
    for (const role of SUPPORT_MESSAGE_AUTHOR_ROLES) {
      expect(['customer', 'staff', 'system']).toContain(role);
    }
  });

  it('defines transitions only between known statuses', () => {
    for (const status of SUPPORT_STATUSES) {
      for (const next of SUPPORT_STATUS_TRANSITIONS[status]) {
        expect(SUPPORT_STATUSES).toContain(next);
      }
    }
  });

  it('never leaves a customer able to reopen from active states', () => {
    expect(canTransitionStatus('open', 'open')).toBe(false);
    expect(canTransitionStatus('resolved', 'closed')).toBe(true);
    expect(canTransitionStatus('closed', 'open')).toBe(false);
  });
});

describe('active status helpers', () => {
  it('matches the catalog active set', () => {
    expect(isActiveSupportStatus('open')).toBe(true);
    expect(isActiveSupportStatus('resolved')).toBe(false);
    expect(ACTIVE_SUPPORT_STATUSES).not.toContain('closed');
  });
});

describe('categoryForTool', () => {
  it('maps email tools to the email category', () => {
    expect(categoryForTool('email_analyze')).toBe('email');
    expect(categoryForTool('dns_spf')).toBe('email');
    expect(categoryForTool('dns_dmarc')).toBe('email');
  });

  it('maps DNS tools to the dns category', () => {
    expect(categoryForTool('dns_lookup')).toBe('dns');
    expect(categoryForTool('dns_health')).toBe('dns');
  });

  it('maps PTR to hosting and unknown tools to other', () => {
    expect(categoryForTool('dns_ptr')).toBe('hosting');
    expect(categoryForTool('mystery_tool')).toBe('other');
    expect(categoryForTool(null)).toBe('other');
  });
});
