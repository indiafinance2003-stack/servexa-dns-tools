import { BillingIntervalConfig } from '@/lib/config';

/**
 * Pure period math for subscription cycles.
 *
 * A cycle always begins at the start time and ends `1, 3 or 12 months` later
 * depending on the billing interval. Kept free of database access so the
 * arithmetic can be unit tested exhaustively (months with 28, 29, 30 and 31
 * days, year boundaries, UTC).
 */
export function cycleEnd(start: Date, interval: BillingIntervalConfig): Date {
  const months = interval === 'monthly' ? 1 : interval === 'quarterly' ? 3 : 12;
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + months;
  const lastDayOfTargetMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(start.getUTCDate(), lastDayOfTargetMonth);

  return new Date(
    Date.UTC(
      year,
      month,
      day,
      start.getUTCHours(),
      start.getUTCMinutes(),
      start.getUTCSeconds(),
      start.getUTCMilliseconds()
    )
  );
}