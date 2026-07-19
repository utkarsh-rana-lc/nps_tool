import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';
import { requireSession } from '../middleware/session.js';
import {
  getSummary,
  getTimeseries,
  getAccounts,
  getAccountUsers,
} from '../services/analytics.js';
import type { AnalyticsFilters, Product } from '../types.js';

function parseFilters(q: Record<string, string | undefined>): AnalyticsFilters {
  const product = (q.product ?? 'all') as Product | 'all';
  return {
    product,
    dateFrom: q.dateFrom,
    dateTo: q.dateTo,
    accountRef: q.accountRef,
  };
}

export async function analyticsRoutes(app: FastifyInstance, config: Config) {
  const auth = requireSession(config);

  app.get('/v1/nps/analytics/summary', { preHandler: auth }, async (req) => {
    return getSummary(parseFilters(req.query as Record<string, string | undefined>));
  });

  app.get('/v1/nps/analytics/timeseries', { preHandler: auth }, async (req) => {
    const q = req.query as Record<string, string | undefined>;
    return getTimeseries(parseFilters(q), q.groupByProduct === 'true');
  });

  app.get('/v1/nps/analytics/accounts', { preHandler: auth }, async (req) => {
    const q = req.query as Record<string, string | undefined>;
    return getAccounts(parseFilters(q), {
      sort: q.sort as 'nps' | 'responses' | 'latest' | undefined,
      search: q.search,
    });
  });

  app.get('/v1/nps/analytics/accounts/:accountRef/users', { preHandler: auth }, async (req) => {
    const { accountRef } = req.params as { accountRef: string };
    return getAccountUsers(accountRef, parseFilters(req.query as Record<string, string | undefined>));
  });
}
