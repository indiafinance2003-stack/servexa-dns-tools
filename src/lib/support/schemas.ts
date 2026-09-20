import { z } from 'zod';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
} from '@/lib/db/schema';

/**
 * Support API input schemas.
 *
 * Note what is deliberately ABSENT: there is no `userId`, no `origin` and no
 * `status` field on ticket creation. Ownership comes from the session, origin
 * is derived from the verified entitlement, and the initial status is always
 * 'open'.
 */

const domainLikeSchema = z
  .string()
  .trim()
  .max(253, 'Domain is too long')
  .transform((value) => value.toLowerCase().replace(/\.$/, ''))
  .refine(
    (value) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(value),
    { message: 'Enter a valid domain name (for example example.com)' }
  );

const contextSchema = z
  .object({
    tool: z.string().trim().max(40).optional(),
    domain: z.string().trim().max(253).optional(),
    findingSummary: z.string().trim().max(400).optional(),
    findingCounts: z
      .object({
        error: z.number().int().min(0).max(10_000).optional(),
        warning: z.number().int().min(0).max(10_000).optional(),
        info: z.number().int().min(0).max(10_000).optional(),
        pass: z.number().int().min(0).max(10_000).optional(),
      })
      .strict()
      .optional(),
    diagnosticReference: z.string().trim().max(64).optional(),
    capturedAt: z.string().trim().max(40).optional(),
  })
  .strict();

export const createTicketSchema = z
  .object({
    subject: z
      .string()
      .trim()
      .min(4, 'Give your request a short subject')
      .max(140, 'Subject must be at most 140 characters'),
    description: z
      .string()
      .trim()
      .min(15, 'Describe the problem in at least 15 characters')
      .max(5000, 'Description must be at most 5000 characters'),
    category: z.enum(SUPPORT_CATEGORIES),
    priority: z.enum(SUPPORT_PRIORITIES).optional(),
    affectedDomain: domainLikeSchema.optional(),
    relatedTool: z.string().trim().max(40).optional(),
    /** Extra context collected by the tool that started the request. */
    context: contextSchema.optional(),
  })
  .strict();

export const replyTicketSchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(1, 'Write a message before sending')
      .max(5000, 'Message must be at most 5000 characters'),
  })
  .strict();

export const customerTicketActionSchema = z
  .object({
    action: z.enum(['close', 'confirm_resolution', 'reopen']),
    /** Optional note recorded with the action (never required). */
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

export const ticketListQuerySchema = z
  .object({
    status: z.enum(SUPPORT_STATUSES).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type ReplyTicketInput = z.infer<typeof replyTicketSchema>;
export type CustomerTicketActionInput = z.infer<typeof customerTicketActionSchema>;
export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;
export type TicketContextInput = z.infer<typeof contextSchema>;