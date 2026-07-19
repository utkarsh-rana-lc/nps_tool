/**
 * The monthly cadence pivots on `period_month`: a DATE pinned to the first of
 * the month. We derive it in the account's timezone so "this month" means the
 * customer's month, not UTC's.
 */

/** First-of-month string (YYYY-MM-01) for `now` in the given IANA timezone. */
export function currentPeriodMonth(timezone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  return `${year}-${month}-01`;
}

/** "2026-07-01" (DATE) → "2026-07" (label used across the API + charts). */
export function periodLabel(periodMonth: string): string {
  return periodMonth.slice(0, 7);
}

/** Previous month's period, for delta calculations. */
export function previousPeriodMonth(periodMonth: string): string {
  const [y, m] = periodMonth.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}-01`;
}
