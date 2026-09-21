import { describe, expect, it } from 'vitest';
import { normalizeContactInput, contactStatusLabel, isContactStatus, redactContactEmail } from '@/lib/contact/service';

describe('normalizeContactInput', () => {
  it('trims fields and lowercases the email', () => {
    expect(
      normalizeContactInput({
        name: '  Alice ',
        email: ' Alice@Example.COM ',
        subject: '  Help ',
        message: '  Hello  ',
        ipFingerprint: null,
      })
    ).toEqual({
      name: 'Alice',
      email: 'alice@example.com',
      subject: 'Help',
      message: 'Hello',
    });
  });

  it.each([
    { name: '', email: 'a@b.co', subject: 's', message: 'm' },
    { name: 'x'.repeat(101), email: 'a@b.co', subject: 's', message: 'm' },
  ])('rejects a missing or over-long name %j', (input) => {
    expect(() => normalizeContactInput(input)).toThrow(/name/i);
  });

  it.each([
    { name: 'A', email: '', subject: 's', message: 'm' },
    { name: 'A', email: 'not-an-email', subject: 's', message: 'm' },
    { name: 'A', email: 'a'.repeat(250) + '@b.co', subject: 's', message: 'm' },
  ])('rejects an invalid email %j', (input) => {
    expect(() => normalizeContactInput(input)).toThrow('A valid email address is required.');
  });

  it('rejects a missing or over-long subject', () => {
    expect(() => normalizeContactInput({ name: 'A', email: 'a@b.co', subject: '', message: 'm' })).toThrow(/subject/i);
    expect(() =>
      normalizeContactInput({ name: 'A', email: 'a@b.co', subject: 'x'.repeat(201), message: 'm' })
    ).toThrow(/subject/i);
  });

  it('rejects a missing or over-long message', () => {
    expect(() => normalizeContactInput({ name: 'A', email: 'a@b.co', subject: 's', message: '  ' })).toThrow(
      'A message is required.'
    );
    expect(() =>
      normalizeContactInput({ name: 'A', email: 'a@b.co', subject: 's', message: 'x'.repeat(8001) })
    ).toThrow('The message is limited to 8000 characters.');
  });
});

describe('contact status helpers', () => {
  it('labels known statuses and falls back otherwise', () => {
    expect(contactStatusLabel('spam')).toBe('Spam');
    expect(contactStatusLabel('mystery')).toBe('mystery');
  });

  it('isContactStatus accepts only the known set', () => {
    expect(isContactStatus('reviewed')).toBe(true);
    expect(isContactStatus('actioned')).toBe(true);
    expect(isContactStatus('closed')).toBe(false);
    expect(isContactStatus(null)).toBe(false);
  });
});

describe('redactContactEmail', () => {
  it('masks the local part while keeping at least one visible character', () => {
    expect(redactContactEmail('alice@example.com')).toBe('a••••@example.com');
    expect(redactContactEmail('me@example.com')).toBe('m•@example.com');
  });

  it('returns input unchanged when there is no domain', () => {
    expect(redactContactEmail('not-an-email')).toBe('not-an-email');
  });
});