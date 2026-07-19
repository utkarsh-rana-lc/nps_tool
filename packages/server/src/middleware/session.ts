import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Config } from '../config.js';
import { verifyToken, type SessionClaims } from '../domain/token.js';

declare module 'fastify' {
  interface FastifyRequest {
    session?: SessionClaims & { via: 'jwt' | 'admin_key' };
  }
}

function bearer(req: FastifyRequest): string | null {
  const h = req.headers['authorization'];
  return typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7) : null;
}

/**
 * Accept either a signed dashboard session token (a logged-in operator) OR the
 * server-side admin key (service-to-service / BI export jobs). Attaches
 * req.session so downstream handlers know who is acting.
 */
export function requireSession(config: Config) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const token = bearer(req);
    if (!token) return reply.code(401).send({ error: 'unauthenticated' });

    // Service key path.
    if (token === config.adminApiKey) {
      req.session = { sub: 'service', email: 'service', role: 'admin', via: 'admin_key' };
      return;
    }

    // Dashboard user path.
    const claims = verifyToken(token, config.jwtSecret);
    if (!claims) return reply.code(401).send({ error: 'invalid_or_expired_token' });
    req.session = { ...claims, via: 'jwt' };
  };
}

/** Gate an endpoint to admins (used for user management). */
export function requireRole(role: 'admin') {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.session || req.session.role !== role) {
      return reply.code(403).send({ error: 'forbidden' });
    }
  };
}
