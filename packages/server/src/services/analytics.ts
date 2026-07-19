import { query } from '../db.js';
import { buildResponseFilter } from './filters.js';
import { npsScore, breakdown, rating, type Counts } from '../domain/nps.js';
import { periodLabel } from '../domain/period.js';
import { PRODUCTS, type AnalyticsFilters, type Product } from '../types.js';

interface CategoryRow {
  promoters: string;
  passives: string;
  detractors: string;
}

function toCounts(r: CategoryRow | undefined): Counts {
  return {
    promoters: Number(r?.promoters ?? 0),
    passives: Number(r?.passives ?? 0),
    detractors: Number(r?.detractors ?? 0),
  };
}

const CATEGORY_SELECT = `
  COUNT(*) FILTER (WHERE r.category = 'promoter')  AS promoters,
  COUNT(*) FILTER (WHERE r.category = 'passive')   AS passives,
  COUNT(*) FILTER (WHERE r.category = 'detractor') AS detractors
`;

// ── Summary ───────────────────────────────────────────────────────────────
export async function getSummary(filters: AnalyticsFilters) {
  const f = buildResponseFilter(filters);
  const { rows } = await query<CategoryRow>(
    `SELECT ${CATEGORY_SELECT}
       FROM nps_responses r JOIN accounts a ON a.id = r.account_id
       ${f.where}`,
    f.params,
  );
  const counts = toCounts(rows[0]);
  const nps = npsScore(counts);

  // Prompts in the same window → response rate.
  const { rows: pr } = await query<{ prompts: string }>(
    `SELECT COUNT(*) AS prompts
       FROM survey_prompts p JOIN accounts a ON a.id = p.account_id
       ${buildPromptWhere(filters)}`,
    promptParams(filters),
  );
  const prompts = Number(pr[0]?.prompts ?? 0);
  const responses = counts.promoters + counts.passives + counts.detractors;

  // Previous equal-length window for delta.
  const prev = shiftWindow(filters);
  let previousNps: number | null = null;
  if (prev) {
    const pf2 = buildResponseFilter(prev);
    const { rows: prevRows } = await query<CategoryRow>(
      `SELECT ${CATEGORY_SELECT}
         FROM nps_responses r JOIN accounts a ON a.id = r.account_id
         ${pf2.where}`,
      pf2.params,
    );
    previousNps = npsScore(toCounts(prevRows[0]));
  }

  return {
    filters,
    nps,
    previousNps,
    delta: nps !== null && previousNps !== null ? nps - previousNps : null,
    responses,
    prompts,
    responseRate: prompts > 0 ? responses / prompts : null,
    breakdown: breakdown(counts),
    rating: rating(nps),
  };
}

function buildPromptWhere(filters: AnalyticsFilters): string {
  const clauses: string[] = [];
  let i = 1;
  if (filters.product && filters.product !== 'all') clauses.push(`p.product = $${i++}`);
  if (filters.dateFrom) clauses.push(`p.period_month >= $${i++}`);
  if (filters.dateTo) clauses.push(`p.period_month <= $${i++}`);
  if (filters.accountRef) clauses.push(`a.account_ref = $${i++}`);
  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
}

function promptParams(filters: AnalyticsFilters): unknown[] {
  const params: unknown[] = [];
  if (filters.product && filters.product !== 'all') params.push(filters.product);
  if (filters.dateFrom) params.push(`${filters.dateFrom.slice(0, 7)}-01`);
  if (filters.dateTo) params.push(`${filters.dateTo.slice(0, 7)}-01`);
  if (filters.accountRef) params.push(filters.accountRef);
  return params;
}

/** Shift the filter window back by its own length for period-over-period delta. */
function shiftWindow(filters: AnalyticsFilters): AnalyticsFilters | null {
  if (!filters.dateFrom || !filters.dateTo) return null;
  const from = monthIndex(filters.dateFrom);
  const to = monthIndex(filters.dateTo);
  const len = to - from + 1;
  return {
    ...filters,
    dateFrom: fromMonthIndex(from - len),
    dateTo: fromMonthIndex(from - 1),
  };
}

function monthIndex(date: string): number {
  const [y, m] = date.split('-').map(Number);
  return y * 12 + (m - 1);
}
function fromMonthIndex(idx: number): string {
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

// ── Timeseries (the trend graph) ────────────────────────────────────────────
export async function getTimeseries(
  filters: AnalyticsFilters,
  groupByProduct: boolean,
) {
  const f = buildResponseFilter(filters);
  const { rows } = await query<CategoryRow & { period_month: string; product: Product }>(
    `SELECT r.period_month, r.product, ${CATEGORY_SELECT}
       FROM nps_responses r JOIN accounts a ON a.id = r.account_id
       ${f.where}
      GROUP BY r.period_month, r.product
      ORDER BY r.period_month ASC`,
    f.params,
  );

  // Overall series (all products collapsed per month).
  const byMonth = new Map<string, Counts>();
  for (const row of rows) {
    const key = row.period_month;
    const c = byMonth.get(key) ?? { promoters: 0, passives: 0, detractors: 0 };
    c.promoters += Number(row.promoters);
    c.passives += Number(row.passives);
    c.detractors += Number(row.detractors);
    byMonth.set(key, c);
  }
  const points = [...byMonth.entries()].map(([month, c]) => ({
    period: periodLabel(month),
    nps: npsScore(c),
    responses: c.promoters + c.passives + c.detractors,
  }));

  const result: {
    granularity: 'month';
    points: typeof points;
    byProduct?: Record<Product, typeof points>;
  } = { granularity: 'month', points };

  if (groupByProduct) {
    const perProduct = Object.fromEntries(
      PRODUCTS.map((p) => [p, new Map<string, Counts>()]),
    ) as Record<Product, Map<string, Counts>>;
    for (const row of rows) {
      const map = perProduct[row.product];
      const c = map.get(row.period_month) ?? { promoters: 0, passives: 0, detractors: 0 };
      c.promoters += Number(row.promoters);
      c.passives += Number(row.passives);
      c.detractors += Number(row.detractors);
      map.set(row.period_month, c);
    }
    result.byProduct = Object.fromEntries(
      PRODUCTS.map((p) => [
        p,
        [...perProduct[p].entries()].map(([month, c]) => ({
          period: periodLabel(month),
          nps: npsScore(c),
          responses: c.promoters + c.passives + c.detractors,
        })),
      ]),
    ) as Record<Product, typeof points>;
  }

  return result;
}

// ── Per-account roll-up (the table) ─────────────────────────────────────────
export async function getAccounts(
  filters: AnalyticsFilters,
  opts: { sort?: 'nps' | 'responses' | 'latest'; search?: string } = {},
) {
  const f = buildResponseFilter(filters);
  const searchClause = opts.search
    ? `${f.where ? 'AND' : 'WHERE'} (a.account_ref ILIKE $${f.params.length + 1} OR a.name ILIKE $${f.params.length + 1})`
    : '';
  const params = opts.search ? [...f.params, `%${opts.search}%`] : f.params;

  const { rows } = await query<
    CategoryRow & {
      account_ref: string;
      account_name: string | null;
      responses: string;
      latest_score: number | null;
      latest_at: string | null;
      by_product: Record<string, { promoters: number; passives: number; detractors: number }>;
    }
  >(
    `SELECT a.account_ref, a.name AS account_name,
            ${CATEGORY_SELECT},
            COUNT(*) AS responses,
            (ARRAY_AGG(r.score ORDER BY r.created_at DESC))[1] AS latest_score,
            MAX(r.created_at) AS latest_at,
            jsonb_object_agg(r.product, jsonb_build_object()) AS by_product
       FROM nps_responses r JOIN accounts a ON a.id = r.account_id
       ${f.where} ${searchClause}
      GROUP BY a.account_ref, a.name`,
    params,
  );

  const accounts = await Promise.all(
    rows.map(async (row) => {
      const counts = toCounts(row);
      const byProduct = await accountProductNps(row.account_ref, filters);
      return {
        accountRef: row.account_ref,
        accountName: row.account_name,
        nps: npsScore(counts),
        responses: Number(row.responses),
        promoters: counts.promoters,
        passives: counts.passives,
        detractors: counts.detractors,
        latestScore: row.latest_score,
        latestAt: row.latest_at,
        byProduct,
      };
    }),
  );

  const sort = opts.sort ?? 'nps';
  accounts.sort((a, b) => {
    if (sort === 'responses') return b.responses - a.responses;
    if (sort === 'latest') return (b.latestAt ?? '').localeCompare(a.latestAt ?? '');
    return (b.nps ?? -101) - (a.nps ?? -101);
  });

  return { accounts };
}

async function accountProductNps(
  accountRef: string,
  filters: AnalyticsFilters,
): Promise<Record<Product, number | null>> {
  const f = buildResponseFilter({ ...filters, accountRef, product: 'all' });
  const { rows } = await query<CategoryRow & { product: Product }>(
    `SELECT r.product, ${CATEGORY_SELECT}
       FROM nps_responses r JOIN accounts a ON a.id = r.account_id
       ${f.where}
      GROUP BY r.product`,
    f.params,
  );
  const out = { crm: null, marketing: null, bot: null } as Record<Product, number | null>;
  for (const row of rows) out[row.product] = npsScore(toCounts(row));
  return out;
}

// ── Per-user rows within one account ────────────────────────────────────────
export async function getAccountUsers(accountRef: string, filters: AnalyticsFilters) {
  const f = buildResponseFilter({ ...filters, accountRef });
  const { rows } = await query<{
    email: string;
    user_ref: string | null;
    product: Product;
    period_month: string;
    score: number;
    category: string;
    reason: string | null;
    created_at: string;
  }>(
    `SELECT u.email, u.user_ref, r.product, r.period_month,
            r.score, r.category, r.reason, r.created_at
       FROM nps_responses r
       JOIN accounts a ON a.id = r.account_id
       JOIN users u ON u.id = r.user_id
       ${f.where}
      ORDER BY r.created_at DESC`,
    f.params,
  );
  return {
    accountRef,
    users: rows.map((r) => ({
      email: r.email,
      userRef: r.user_ref,
      product: r.product,
      period: periodLabel(r.period_month),
      score: r.score,
      category: r.category,
      reason: r.reason,
      respondedAt: r.created_at,
    })),
  };
}
