import { and, desc, eq, sql } from 'drizzle-orm';
import { config } from '@/lib/config';
import { dbFromRequest } from '@/lib/db/request';
import { isPaymentConfigured } from './providers';
import {
  invoices,
  INVOICE_STATUSES,
  type InvoiceRow,
  type InvoiceStatus,
} from '@/lib/db/schema';

/**
 * Invoice read foundation.
 *
 * ONLY rows that exist in the `invoices` table are ever returned. No invoice is
 * generated to populate a dashboard, and there is no simulated payment state:
 * an account with no invoices sees an explicit empty state.
 */

export interface InvoiceDTO {
  id: string;
  invoiceNumber: string;
  status: string;
  statusLabel: string;
  /** Recorded amount in minor units, or null when the amount was not recorded. */
  amountMinor: number | null;
  currency: string;
  /** Formatted amount, or an explicit "not recorded" label. */
  amountFormatted: string;
  description: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  issuedAt: string;
  paidAt: string | null;
  /** True only when the record really carries a payment provider reference. */
  providerLinked: boolean;
}

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  pending: 'Awaiting payment',
  paid: 'Paid',
  void: 'Void',
  uncollectible: 'Uncollectible',
};

export function invoiceStatusLabel(status: string): string {
  return INVOICE_STATUSES.includes(status as InvoiceStatus)
    ? INVOICE_STATUS_LABELS[status as InvoiceStatus]
    : status;
}

export function formatMinorAmount(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function toDTO(row: InvoiceRow): InvoiceDTO {
  const amountMinor = typeof row.amount === 'number' ? row.amount : null;
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    status: row.status,
    statusLabel: invoiceStatusLabel(row.status),
    amountMinor,
    currency: row.currency,
    amountFormatted:
      amountMinor === null ? 'Amount not recorded' : formatMinorAmount(amountMinor, row.currency),
    description: row.description,
    periodStart: row.periodStart ? row.periodStart.toISOString() : null,
    periodEnd: row.periodEnd ? row.periodEnd.toISOString() : null,
    // `issued_at` is nullable in the schema; fall back to the creation time so a
    // real row always shows a real date.
    issuedAt: (row.issuedAt ?? row.createdAt).toISOString(),
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    providerLinked:
      typeof row.providerInvoiceId === 'string' && row.providerInvoiceId.length > 0,
  };
}

/** All invoices for one customer. The user id must come from the session. */
export async function listInvoices(userId: string, limit = 50): Promise<InvoiceDTO[]> {
  const { db } = dbFromRequest();
  const rows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.userId, userId))
    .orderBy(desc(invoices.issuedAt))
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows.map(toDTO);
}

/**
 * A single invoice for one customer. The `userId` predicate is part of the
 * query, so an invoice id belonging to another account is indistinguishable
 * from a missing invoice (no IDOR, no existence disclosure).
 */
export async function getInvoice(userId: string, invoiceId: string): Promise<InvoiceDTO | null> {
  const { db } = dbFromRequest();
  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
    .limit(1);
  return rows[0] ? toDTO(rows[0]) : null;
}

/**
 * Invoice numbering for the internal billing operations (Part 4).
 *
 * A stable, sequential, year-scoped number: `<PREFIX>-<YYYY>-<000001>`. The
 * prefix lives in configuration so it can be changed without touching code.
 * Numbers are derived from the highest existing number for the year, and the
 * `invoice_number` unique constraint makes a duplicate impossible.
 */
export async function nextInvoiceNumber(now: Date = new Date()): Promise<string> {
  const { db } = dbFromRequest();
  const year = now.getUTCFullYear();
  const prefix = `${config.INVOICE_NUMBER_PREFIX}-${year}-`;
  const rows = await db
    .select({ value: sql<string | null>`max(${invoices.invoiceNumber})` })
    .from(invoices)
    .where(sql`${invoices.invoiceNumber} like ${`${prefix}%`}`);

  const highest = rows[0]?.value ?? null;
  const sequence = highest ? Number.parseInt(highest.slice(prefix.length), 10) : 0;
  const next = Number.isFinite(sequence) ? sequence + 1 : 1;
  return `${prefix}${String(next).padStart(6, '0')}`;
}

/**
 * Whether the billing integration can currently produce invoices at all. When
 * false the UI must not show any checkout or "pay now" affordance.
 */
export function invoiceGenerationAvailable(): boolean {
  return isPaymentConfigured();
}