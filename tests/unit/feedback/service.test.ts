import { describe, expect, it } from 'vitest';
import { normalizeFeedbackInput, feedbackCategoryLabel, feedbackStatusLabel, isFeedbackStatus } from '@/lib/feedback/service';

describe('normalizeFeedbackInput', () => {
  it('normalizes a valid submission', () => {
    expect(
      normalizeFeedbackInput({ rating: 4, category: 'dns', message: '  The DNS tools are handy.  ' })
    ).toEqual({ rating: 4, category: 'dns', message: 'The DNS tools are handy.' });
  });

  it('defaults a missing category to other', () => {
    expect(normalizeFeedbackInput({ rating: 5, message: 'Thanks' }).category).toBe('other');
  });

  it('accepts a numeric-string rating', () => {
    expect(normalizeFeedbackInput({ rating: '3', message: 'ok' }).rating).toBe(3);
  });

  it.each([0, 6, -1, 2.5, 'high', null, undefined])('rejects rating %j', (rating) => {
    expect(() => normalizeFeedbackInput({ rating, message: 'x' })).toThrow(
      'Rating must be a whole number between 1 and 5.'
    );
  });

  it('rejects an unknown category', () => {
    expect(() => normalizeFeedbackInput({ rating: 3, category: 'nope', message: 'x' })).toThrow(
      'Unknown feedback category.'
    );
  });

  it('rejects a missing message, but trims whitespace-only input', () => {
    expect(() => normalizeFeedbackInput({ rating: 3, message: '' })).toThrow('A message is required.');
    expect(() => normalizeFeedbackInput({ rating: 3, message: '   ' })).toThrow('A message is required.');
  });

  it('rejects an over-long message', () => {
    expect(() =>
      normalizeFeedbackInput({ rating: 3, message: 'x'.repeat(5001) })
    ).toThrow('Feedback is limited to 5000 characters.');
  });
});

describe('feedback labels and guards', () => {
  it('maps categories and statuses to human labels', () => {
    expect(feedbackCategoryLabel('tools')).toBe('Diagnostic tools');
    expect(feedbackStatusLabel('acknowledged')).toBe('Acknowledged');
  });

  it('falls back to the raw string for unknown values', () => {
    expect(feedbackCategoryLabel('custom')).toBe('custom');
    expect(feedbackStatusLabel('weird')).toBe('weird');
  });

  it('isFeedbackStatus accepts only the known set', () => {
    expect(isFeedbackStatus('new')).toBe(true);
    expect(isFeedbackStatus('addressed')).toBe(true);
    expect(isFeedbackStatus('open')).toBe(false);
    expect(isFeedbackStatus(42)).toBe(false);
  });
});