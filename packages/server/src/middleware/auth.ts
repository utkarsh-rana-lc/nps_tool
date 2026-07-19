import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Config } from '../config.js';

/** Widget endpoints: accept a known public write key. */
export function requireWriteKey(config: Config) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const key = req.headers['x-nps-write-key'];
    if (typeof key !== 'string' || !config.writeKeys.has(key)) {
      reply.code(401).send({ error: 'invalid_write_key' });
    }
  };
}

/** Dashboard endpoints: require the server-side admin key. */
export function requireAdminKey(config: Config) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers['authorization'];
    const token = typeof header === 'string' && header.startsWith('Bearer ')
      ? header.slice(7)
      : null;
    if (!token || token !== config.adminApiKey) {
      reply.code(401).send({ error: 'invalid_admin_key' });
    }
  };
}
