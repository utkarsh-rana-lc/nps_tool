import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';
import { requireWriteKey } from '../middleware/auth.js';
import { checkEligibility } from '../services/eligibility.js';
import { submitResponse, dismissPrompt, IngestError } from '../services/ingest.js';
import { isProduct } from '../types.js';

export async function widgetRoutes(app: FastifyInstance, config: Config) {
  const auth = requireWriteKey(config);

  // GET /v1/nps/eligibility
  app.get('/v1/nps/eligibility', { preHandler: auth }, async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    if (!isProduct(q.product)) return reply.code(400).send({ error: 'invalid_product' });
    if (!q.accountRef) return reply.code(400).send({ error: 'missing_accountRef' });
    if (!q.email) return reply.code(400).send({ error: 'missing_email' });

    const result = await checkEligibility({
      product: q.product,
      accountRef: q.accountRef,
      accountName: q.accountName,
      email: q.email,
      userRef: q.userRef,
    });
    return reply.send(result);
  });

  // POST /v1/nps/responses
  app.post('/v1/nps/responses', { preHandler: auth }, async (req, reply) => {
    const body = req.body as { promptId?: string; score?: number; reason?: string };
    if (!body.promptId) return reply.code(400).send({ error: 'missing_promptId' });
    if (typeof body.score !== 'number') return reply.code(400).send({ error: 'missing_score' });

    try {
      const result = await submitResponse({
        promptId: body.promptId,
        score: body.score,
        reason: body.reason,
      });
      return reply.code(201).send(result);
    } catch (err) {
      if (err instanceof IngestError) {
        const status = err.code === 'prompt_not_found' ? 404
          : err.code === 'already_responded' ? 409 : 400;
        return reply.code(status).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  // POST /v1/nps/responses/:promptId/dismiss
  app.post('/v1/nps/responses/:promptId/dismiss', { preHandler: auth }, async (req, reply) => {
    const { promptId } = req.params as { promptId: string };
    await dismissPrompt(promptId);
    return reply.code(204).send();
  });
}
