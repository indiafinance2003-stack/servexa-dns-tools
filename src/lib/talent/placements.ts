import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { dbFromRequest } from '@/lib/db/request';
import { talentApplications, talentPlacements, type TalentPlacementRow } from '@/lib/db/schema';
import { recordTalentActivity } from './activity';
import { isTalentPaymentStatus } from './catalog';
import { TalentNotFoundError, TalentValidationError } from './errors';
import { calculatePlacementFee, computeReplacementUntil, percentToBasisPoints } from './policy';
import type { TalentPlacementInput } from './schemas';

export interface TalentPlacementDTO {
  id: string;
  applicationId: string;
  candidateId: string;
  clientId: string | null;
  jobId: string | null;
  placementDate: string | null;
  joiningDate: string | null;
  annualCtcMinor: number | null;
  feeType: string;
  feePercentageBps: number | null;
  fixedFeeMinor: number | null;
  feeAmountMinor: number | null;
  paymentStatus: string;
  paymentDueDate: string | null;
  replacementPeriodDays: number | null;
  replacementUntil: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

function toDTO(row: TalentPlacementRow): TalentPlacementDTO {
  return {
    id: row.id,
    applicationId: row.applicationId,
    candidateId: row.candidateId,
    clientId: row.clientId,
    jobId: row.jobId,
    placementDate: row.placementDate ? row.placementDate.toISOString() : null,
    joiningDate: row.joiningDate ? row.joiningDate.toISOString() : null,
    annualCtcMinor: row.annualCtc,
    feeType: row.feeType,
    feePercentageBps: row.feePercentage,
    fixedFeeMinor: row.fixedFee,
    feeAmountMinor: row.feeAmount,
    paymentStatus: row.paymentStatus,
    paymentDueDate: row.paymentDueDate ? row.paymentDueDate.toISOString() : null,
    replacementPeriodDays: row.replacementPeriodDays,
    replacementUntil: row.replacementUntil ? row.replacementUntil.toISOString() : null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toMinor(rupees: number | undefined): number | null {
  if (rupees === undefined) return null;
  return Math.round(rupees * 100);
}

export async function createPlacement(actor: string | null, input: TalentPlacementInput): Promise<TalentPlacementDTO> {
  const { db } = dbFromRequest();
  const apps = await db.select().from(talentApplications).where(eq(talentApplications.id, input.applicationId)).limit(1);
  const app = apps[0] ?? null;
  if (!app) throw new TalentNotFoundError('application');
  const annualCtc = toMinor(input.annualCtc);
  const fixedFee = toMinor(input.fixedFee);
  const bps = input.feePercentage === undefined ? null : percentToBasisPoints(input.feePercentage);
  if (input.feeType === 'percentage' && (annualCtc === null || bps === null)) {
    throw new TalentValidationError('A percentage fee needs a fee percentage and an annual CTC.');
  }
  const feeAmount = calculatePlacementFee({ feeType: input.feeType, annualCtcMinor: annualCtc, feeBasisPoints: bps, fixedFeeMinor: fixedFee });
  const joiningDate = toDate(input.joiningDate);
  const replacementUntil = computeReplacementUntil(joiningDate, input.replacementPeriodDays ?? null);
  const { talentJobs } = await import('@/lib/db/schema');
  const jobs = await db.select().from(talentJobs).where(eq(talentJobs.id, app.jobId)).limit(1);
  const job = jobs[0] ?? null;
  const [row] = await db.insert(talentPlacements).values({
    applicationId: app.id,
    candidateId: app.candidateId,
    clientId: job?.clientId ?? null,
    jobId: app.jobId,
    placementDate: toDate(input.placementDate),
    joiningDate,
    annualCtc,
    feeType: input.feeType,
    feePercentage: bps,
    fixedFee,
    feeAmount,
    paymentStatus: input.paymentStatus ?? 'PENDING',
    paymentDueDate: toDate(input.paymentDueDate),
    replacementPeriodDays: input.replacementPeriodDays ?? null,
    replacementUntil,
    notes: input.notes ?? null,
  }).returning();
  await recordTalentActivity(actor, {
    entityType: 'placement', entityId: row.id, action: 'placement_created',
    summary: `Placement recorded for application ${app.applicationId}`,
    metadata: { applicationId: app.id, feeAmountMinor: feeAmount, paymentStatus: row.paymentStatus },
  });
  return toDTO(row);
}

export async function updatePlacementPaymentStatus(actor: string | null, id: string, status: string): Promise<TalentPlacementDTO> {
  if (!isTalentPaymentStatus(status)) throw new TalentValidationError(`Unknown payment status: ${status}`);
  const { db } = dbFromRequest();
  const rows = await db.select().from(talentPlacements).where(eq(talentPlacements.id, id)).limit(1);
  const existing = rows[0] ?? null;
  if (!existing) throw new TalentNotFoundError('placement');
  const [row] = await db.update(talentPlacements).set({ paymentStatus: status, updatedAt: new Date() }).where(eq(talentPlacements.id, id)).returning();
  await recordTalentActivity(actor, {
    entityType: 'placement', entityId: id, action: 'payment_status_changed',
    summary: `Payment: ${existing.paymentStatus} -> ${status}`,
    metadata: { from: existing.paymentStatus, to: status, feeAmountMinor: row.feeAmount },
  });
  return toDTO(row);
}

export interface ListPlacementsOptions {
  /** Payment status filter (validated against the payment status vocabulary). */
  status?: string;
  clientId?: string;
  limit?: number;
}

/**
 * Owner placement list. Payment-status and client filters are applied in SQL;
 * an unrecognised payment status is ignored rather than passed through.
 */
export async function listPlacements(options: ListPlacementsOptions = {}): Promise<TalentPlacementDTO[]> {
  const { db } = dbFromRequest();
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 200);
  const filters = [];
  if (options.status && isTalentPaymentStatus(options.status)) {
    filters.push(eq(talentPlacements.paymentStatus, options.status));
  }
  if (options.clientId) {
    filters.push(eq(talentPlacements.clientId, options.clientId));
  }
  const rows =
    filters.length > 0
      ? await db
          .select()
          .from(talentPlacements)
          .where(and(...filters))
          .orderBy(desc(talentPlacements.createdAt))
          .limit(limit)
      : await db
          .select()
          .from(talentPlacements)
          .orderBy(desc(talentPlacements.createdAt))
          .limit(limit);
  return rows.map(toDTO);
}

export async function getTalentPlacement(id: string): Promise<TalentPlacementDTO> {
  const { db } = dbFromRequest();
  const rows = await db.select().from(talentPlacements).where(eq(talentPlacements.id, id)).limit(1);
  const row = rows[0] ?? null;
  if (!row) throw new TalentNotFoundError('placement');
  return toDTO(row);
}

export async function placementRevenueTotals(): Promise<{ pendingMinor: number; paidMinor: number }> {
  const rows = await listPlacements({ limit: 200 });
  let pendingMinor = 0;
  let paidMinor = 0;
  for (const row of rows) {
    const amount = row.feeAmountMinor ?? 0;
    if (row.paymentStatus === 'PAID') paidMinor += amount;
    else if (row.paymentStatus !== 'WAIVED') pendingMinor += amount;
  }
  return { pendingMinor, paidMinor };
}
