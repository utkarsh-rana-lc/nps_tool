import type { FastifyInstance } from 'fastify';
import { Readable } from 'node:stream';
import type { Config } from '../config.js';
import { requireSession } from '../middleware/session.js';
import { exportCsv } from '../services/export.js';
import type { AnalyticsFilters, Product } from '../types.js';

export async function exportRoutes(app: FastifyInstance, config: Config) {
  const auth = requireSession(config);

  // Per-account report: GET /v1/nps/export/accounts/:accountRef.csv
  app.get('/v1/nps/export/accounts/:accountRef.csv', { preHandler: auth }, async (req, reply) => {
    const { accountRef } = req.params as { accountRef: string };
    const q = req.query as Record<string, string | undefined>;
    const filters: AnalyticsFilters = {
      accountRef,
      product: (q.product ?? 'all') as Product | 'all',
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
    };
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="nps_${accountRef}.csv"`);
    return reply.send(Readable.from(exportCsv(filters)));
  });

  // Bulk report: GET /v1/nps/export/all.csv
  app.get('/v1/nps/export/all.csv', { preHandler: auth }, async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const filters: AnalyticsFilters = {
      product: (q.product ?? 'all') as Product | 'all',
      dateFrom: q.dateFrom,
      dateTo: q.dateTo,
      accountRef: q.accountRef,
    };
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="nps_all_accounts.csv"');
    return reply.send(Readable.from(exportCsv(filters)));
  });
}
