import { query } from '../db.js';
import { buildResponseFilter } from './filters.js';
import { periodLabel } from '../domain/period.js';
import type { AnalyticsFilters } from '../types.js';

const HEADER = [
  'period',
  'response_at',
  'product',
  'account_ref',
  'account_name',
  'email',
  'user_ref',
  'score',
  'category',
  'reason',
];

/**
 * CSV-injection-safe cell encoder. Values starting with = + - @ are prefixed
 * with a single quote so spreadsheets don't execute them as formulas, then the
 * whole cell is quoted and inner quotes doubled.
 */
function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(',');
}

/** Stream every raw response matching the filter as CSV text (async generator). */
export async function* exportCsv(filters: AnalyticsFilters): AsyncGenerator<string> {
  yield HEADER.join(',') + '\n';

  const f = buildResponseFilter(filters);
  const { rows } = await query<{
    period_month: string;
    created_at: string;
    product: string;
    account_ref: string;
    account_name: string | null;
    email: string;
    user_ref: string | null;
    score: number;
    category: string;
    reason: string | null;
  }>(
    `SELECT r.period_month, r.created_at, r.product,
            a.account_ref, a.name AS account_name,
            u.email, u.user_ref, r.score, r.category, r.reason
       FROM nps_responses r
       JOIN accounts a ON a.id = r.account_id
       JOIN users u ON u.id = r.user_id
       ${f.where}
      ORDER BY r.created_at DESC`,
    f.params,
  );

  for (const r of rows) {
    yield csvRow([
      periodLabel(r.period_month),
      r.created_at,
      r.product,
      r.account_ref,
      r.account_name,
      r.email,
      r.user_ref,
      r.score,
      r.category,
      r.reason,
    ]) + '\n';
  }
}
