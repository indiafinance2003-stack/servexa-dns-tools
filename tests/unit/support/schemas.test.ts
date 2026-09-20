import { describe, expect, it } from 'vitest';
import {
  createTicketSchema,
  replyTicketSchema,
  customerTicketActionSchema,
  ticketListQuerySchema,
} from '@/lib/support/schemas';

const validTicket = {
  subject: 'Mail is bouncing',
  description: 'Since Monday, messages to info@example.com bounce with a 550 error.',
  category: 'email' as const,
};

describe('createTicketSchema', () => {
  it('accepts a valid ticket', () => {
    const result = createTicketSchema.safeParse(validTicket);
    expect(result.success).toBe(true);
  });

  it('normalizes the affected domain', () => {
    const result = createTicketSchema.safeParse({ ...validTicket, affectedDomain: ' Example.COM.' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.affectedDomain).toBe('example.com');
  });

  it('rejects subjects shorter than four characters', () => {
    expect(createTicketSchema.safeParse({ ...validTicket, subject: 'hi' }).success).toBe(false);
  });

  it('rejects descriptions shorter than fifteen characters', () => {
    expect(
      createTicketSchema.safeParse({ ...validTicket, description: 'too short' }).success
    ).toBe(false);
  });

  it('rejects unknown categories', () => {
    expect(
      createTicketSchema.safeParse({ ...validTicket, category: 'telepathy' }).success
    ).toBe(false);
  });

  it('rejects client-controlled ownership, origin and status fields', () => {
    expect(createTicketSchema.safeParse({ ...validTicket, userId: 'u1' }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...validTicket, origin: 'managed_support' }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...validTicket, status: 'closed' }).success).toBe(false);
  });

  it('rejects unexpected context keys', () => {
    expect(
      createTicketSchema.safeParse({ ...validTicket, context: { evil: 'payload' } }).success
    ).toBe(false);
  });

  it('accepts bounded diagnostic context', () => {
    const result = createTicketSchema.safeParse({
      ...validTicket,
      context: { tool: 'dns_lookup', domain: 'example.com', findingCounts: { error: 2 } },
    });
    expect(result.success).toBe(true);
  });
});

describe('replyTicketSchema', () => {
  it('requires a non-empty body and rejects oversized messages', () => {
    expect(replyTicketSchema.safeParse({ body: 'Here are the requested records.' }).success).toBe(true);
    expect(replyTicketSchema.safeParse({ body: '   ' }).success).toBe(false);
    expect(replyTicketSchema.safeParse({ body: 'x'.repeat(5001) }).success).toBe(false);
  });

  it('rejects extra fields such as authorRole', () => {
    expect(
      replyTicketSchema.safeParse({ body: 'Hello', authorRole: 'staff' }).success
    ).toBe(false);
  });
});

describe('customerTicketActionSchema', () => {
  it('accepts only the supported customer actions', () => {
    expect(customerTicketActionSchema.safeParse({ action: 'close' }).success).toBe(true);
    expect(customerTicketActionSchema.safeParse({ action: 'confirm_resolution' }).success).toBe(true);
    expect(customerTicketActionSchema.safeParse({ action: 'reopen' }).success).toBe(true);
    expect(customerTicketActionSchema.safeParse({ action: 'assign_to_me' }).success).toBe(false);
    expect(customerTicketActionSchema.safeParse({ action: 'delete' }).success).toBe(false);
  });

  it('bounds the optional note', () => {
    expect(
      customerTicketActionSchema.safeParse({ action: 'close', note: 'x'.repeat(1001) }).success
    ).toBe(false);
  });
});

describe('ticketListQuerySchema', () => {
  it('coerces and bounds the limit', () => {
    expect(ticketListQuerySchema.safeParse({ limit: '10' }).success).toBe(true);
    expect(ticketListQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
    expect(ticketListQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
  });

  it('accepts only valid status filters', () => {
    expect(ticketListQuerySchema.safeParse({ status: 'open' }).success).toBe(true);
    expect(ticketListQuerySchema.safeParse({ status: 'hacked' }).success).toBe(false);
  });
});
