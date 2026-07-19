import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';
import { requireSession, requireRole } from '../middleware/session.js';
import { getAllSettings, upsertSetting } from '../repositories/surveySettings.js';
import { isProduct } from '../types.js';

export async function settingsRoutes(app: FastifyInstance, config: Config) {
  const session = requireSession(config);
  const adminOnly = requireRole('admin');

  // GET /v1/nps/settings — current survey copy for all products (any signed-in user).
  app.get('/v1/nps/settings', { preHandler: session }, async () => {
    const settings = await getAllSettings();
    return {
      settings: settings.map((s) => ({
        product: s.product,
        question: s.question,
        reasonPrompt: s.reason_prompt,
        updatedAt: s.updated_at,
      })),
    };
  });

  // PUT /v1/nps/settings/:product — edit the message (admin only).
  app.put('/v1/nps/settings/:product', { preHandler: [session, adminOnly] }, async (req, reply) => {
    const { product } = req.params as { product: string };
    if (!isProduct(product)) return reply.code(400).send({ error: 'invalid_product' });
    const b = (req.body ?? {}) as { question?: string; reasonPrompt?: string };
    if (!b.question || !b.reasonPrompt) {
      return reply.code(400).send({ error: 'missing_fields', message: 'question and reasonPrompt are required' });
    }
    if (b.question.length > 300 || b.reasonPrompt.length > 300) {
      return reply.code(400).send({ error: 'too_long', message: 'max 300 characters' });
    }
    const saved = await upsertSetting(product, b.question.trim(), b.reasonPrompt.trim());
    return reply.send({
      setting: { product: saved.product, question: saved.question, reasonPrompt: saved.reason_prompt },
    });
  });
}
