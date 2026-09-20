import { describe, expect, it } from 'vitest';
import {
  buildDiagnosticContext,
  parseDiagnosticContext,
  describeDiagnosticContext,
  sanitizeContextText,
  MAX_CONTEXT_FIELD_LENGTH,
} from '@/lib/support/context';

describe('sanitizeContextText', () => {
  it('collapses whitespace and control characters', () => {
    expect(sanitizeContextText('  a\nb\tc\u0000d  ', 100)).toBe('a b c d');
  });

  it('enforces the maximum length', () => {
    expect(sanitizeContextText('x'.repeat(500), MAX_CONTEXT_FIELD_LENGTH)).toHaveLength(
      MAX_CONTEXT_FIELD_LENGTH
    );
  });
});

describe('buildDiagnosticContext', () => {
  it('returns null for empty or non-object input', () => {
    expect(buildDiagnosticContext(null)).toBeNull();
    expect(buildDiagnosticContext('nope')).toBeNull();
    expect(buildDiagnosticContext({})).toBeNull();
  });

  it('keeps whitelisted fields and drops unknown keys', () => {
    const context = buildDiagnosticContext({
      tool: 'dns_lookup',
      domain: 'Example.COM.',
      findingSummary: 'SPF record missing',
      evil: 'DROP TABLE users',
    });
    expect(context).not.toBeNull();
    expect(context?.tool).toBe('dns_lookup');
    expect(context?.domain).toBe('example.com');
    expect(context?.findingSummary).toBe('SPF record missing');
    expect(JSON.stringify(context)).not.toContain('DROP TABLE');
  });

  it('rejects tool names with unexpected characters', () => {
    // A tool name that fails sanitization carries no content, so the whole
    // context is null rather than a context with a nulled field.
    expect(buildDiagnosticContext({ tool: 'bad tool; DROP TABLE users' })).toBeNull();
    const context = buildDiagnosticContext({ tool: 'bad tool', domain: 'example.com' });
    expect(context?.tool).toBeNull();
    expect(context?.domain).toBe('example.com');
  });

  it('rejects invalid domains instead of storing them', () => {
    expect(buildDiagnosticContext({ domain: 'not a domain' })).toBeNull();
    const context = buildDiagnosticContext({ tool: 'dns_lookup', domain: 'not a domain' });
    expect(context?.domain).toBeNull();
    expect(buildDiagnosticContext({ domain: 'example.com' })?.domain).toBe('example.com');
  });

  it('sanitizes finding counts', () => {
    const context = buildDiagnosticContext({
      findingCounts: { error: 3, warning: 2.7, info: -1, pass: 'x', extra: 9 },
    });
    expect(context?.findingCounts).toEqual({ error: 3, warning: 2, info: 0, pass: 0 });
  });

  it('normalizes capturedAt to a valid ISO string (when other content exists)', () => {
    const context = buildDiagnosticContext({
      tool: 'dns_lookup',
      capturedAt: '2026-09-18T10:00:00Z',
    });
    expect(context?.capturedAt).toBe('2026-09-18T10:00:00.000Z');
    // A timestamp alone is not content: an invalid one never creates context.
    expect(buildDiagnosticContext({ capturedAt: 'yesterday' })).toBeNull();
  });
});

describe('parseDiagnosticContext', () => {
  it('re-sanitizes stored values instead of trusting them', () => {
    const parsed = parseDiagnosticContext({
      tool: 'dns_health',
      domain: 'EXAMPLE.com',
      injected: '<script>alert(1)</script>',
    });
    expect(parsed?.domain).toBe('example.com');
    expect(JSON.stringify(parsed)).not.toContain('script');
  });
});

describe('describeDiagnosticContext', () => {
  it('joins tool, domain and finding counts', () => {
    const description = describeDiagnosticContext(
      buildDiagnosticContext({
        tool: 'dns_lookup',
        domain: 'example.com',
        findingCounts: { error: 2, warning: 1, info: 0, pass: 0 },
      })
    );
    expect(description).toContain('dns lookup');
    expect(description).toContain('example.com');
    expect(description).toContain('2 error');
  });

  it('returns null when there is nothing to describe', () => {
    expect(describeDiagnosticContext(null)).toBeNull();
  });
});
