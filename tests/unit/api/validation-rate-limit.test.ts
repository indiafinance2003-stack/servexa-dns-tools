import { describe, it, expect } from 'vitest';
import { InMemoryRateLimiter, checkRateLimit } from '@/lib/security/rate-limit/rate-limiter';
import { RateLimitError } from '@/lib/errors/app-error';
import { parseWithSchema } from '@/lib/validation/parse';
import { dnsLookupSchema } from '@/lib/validation/schemas';
import { ValidationError } from '@/lib/errors/app-error';
import { QueryBudget } from '@/lib/dns/resolver/dns-resolver';
import { DNSRecordType } from '@/types/domain';

describe('Rate limiting', () => {
  it('allows then blocks after the max', () => {
    const limiter = new InMemoryRateLimiter(60_000, 2);
    expect(limiter.isAllowed('a')).toBe(true);
    expect(limiter.isAllowed('a')).toBe(true);
    expect(limiter.isAllowed('a')).toBe(false);
    expect(() => checkRateLimit(limiter, 'a')).toThrow(RateLimitError);
  });
});

describe('API validation', () => {
  it('maps schema failures to ValidationError', () => {
    expect(() => parseWithSchema(dnsLookupSchema, { domain: 'example.com' })).toThrow(ValidationError);
    const ok = parseWithSchema(dnsLookupSchema, { domain: 'example.com', recordType: DNSRecordType.MX });
    expect(ok.recordType).toBe(DNSRecordType.MX);
  });
});

describe('Query budget', () => {
  it('stops additional takes', () => {
    const budget = new QueryBudget(1);
    expect(budget.tryTake()).toBe(true);
    expect(budget.tryTake()).toBe(false);
  });
});
