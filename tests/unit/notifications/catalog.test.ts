import { describe, expect, it } from 'vitest';
import { sanitizeNotificationLink, isEmailDeliveryConfigured } from '@/lib/notifications/catalog';

describe('sanitizeNotificationLink', () => {
  it('accepts internal relative paths', () => {
    expect(sanitizeNotificationLink('/account/support/abc')).toBe('/account/support/abc');
    expect(sanitizeNotificationLink('/account')).toBe('/account');
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeNotificationLink('  /account  ')).toBe('/account');
  });

  it('returns null for empty or missing values', () => {
    expect(sanitizeNotificationLink(null)).toBeNull();
    expect(sanitizeNotificationLink(undefined)).toBeNull();
    expect(sanitizeNotificationLink('   ')).toBeNull();
  });

  it('rejects absolute and protocol-relative URLs (open redirect)', () => {
    expect(sanitizeNotificationLink('https://evil.example/phish')).toBeNull();
    expect(sanitizeNotificationLink('//evil.example')).toBeNull();
    expect(sanitizeNotificationLink('javascript:alert(1)')).toBeNull();
  });

  it('rejects path traversal and whitespace/control characters', () => {
    expect(sanitizeNotificationLink('/account/../../admin')).toBeNull();
    expect(sanitizeNotificationLink('/account/something\nheader: value')).toBeNull();
  });

  it('rejects oversized links', () => {
    expect(sanitizeNotificationLink(`/${'a'.repeat(400)}`)).toBeNull();
  });
});

describe('isEmailDeliveryConfigured', () => {
  it('is false until an email provider and sender are configured', () => {
    // The test environment has no EMAIL_PROVIDER/EMAIL_FROM configured, which is
    // exactly the production posture until a provider is wired up.
    expect(isEmailDeliveryConfigured()).toBe(false);
  });
});
