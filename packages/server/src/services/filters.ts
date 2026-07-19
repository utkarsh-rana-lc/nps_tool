import type { AnalyticsFilters } from '../types.js';
import { isProduct } from '../types.js';

export interface BuiltFilter {
  /** SQL fragment beginning with WHERE, referencing table alias `r`. */
  where: string;
  params: unknown[];
}

/**
 * Build a parameterised WHERE clause for the responses table (alias `r`,
 * joined to accounts `a`). Only whitelisted, typed inputs reach SQL.
 */
export function buildResponseFilter(
  filters: AnalyticsFilters,
  startIndex = 1,
): BuiltFilter {
  const clauses: string[] = [];
  const params: unknown[] = [];
  let i = startIndex;

  if (filters.product && filters.product !== 'all' && isProduct(filters.product)) {
    clauses.push(`r.product = $${i++}`);
    params.push(filters.product);
  }
  if (filters.dateFrom) {
    clauses.push(`r.period_month >= $${i++}`);
    params.push(firstOfMonth(filters.dateFrom));
  }
  if (filters.dateTo) {
    clauses.push(`r.period_month <= $${i++}`);
    params.push(firstOfMonth(filters.dateTo));
  }
  if (filters.accountRef) {
    clauses.push(`a.account_ref = $${i++}`);
    params.push(filters.accountRef);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

function firstOfMonth(date: string): string {
  // 'YYYY-MM-DD' → 'YYYY-MM-01'
  return `${date.slice(0, 7)}-01`;
}
