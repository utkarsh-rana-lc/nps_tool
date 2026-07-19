import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';
import { requireSession, requireRole } from '../middleware/session.js';
import * as auth from '../services/auth.js';
import { AuthError } from '../services/auth.js';
import type { DashboardRole } from '../repositories/dashboardUsers.js';

function handleAuthError(err: unknown, reply: import('fastify').FastifyReply): boolean {
  if (err instanceof AuthError) {
    const status =
      err.code === 'invalid_credentials' ? 401
        : err.code === 'inactive' ? 403
          : err.code === 'not_found' ? 404
            : err.code === 'email_taken' ? 409 : 400;
    reply.code(status).send({ error: err.code, message: err.message });
    return true;
  }
  return false;
}

export async function authRoutes(app: FastifyInstance, config: Config) {
  const session = requireSession(config);
  const adminOnly = requireRole('admin');

  // POST /v1/auth/login  → { token, user }
  app.post('/v1/auth/login', async (req, reply) => {
    const { email, password } = (req.body ?? {}) as { email?: string; password?: string };
    if (!email || !password) return reply.code(400).send({ error: 'missing_credentials' });
    try {
      return reply.send(await auth.login(email, password, config.jwtSecret));
    } catch (err) {
      if (handleAuthError(err, reply)) return;
      throw err;
    }
  });

  // GET /v1/auth/me  → current session's user
  app.get('/v1/auth/me', { preHandler: session }, async (req) => {
    return { user: req.session };
  });

  // ── User management (admin only) ──────────────────────────────────────────
  app.get('/v1/auth/users', { preHandler: [session, adminOnly] }, async () => {
    return { users: await auth.listUsers() };
  });

  app.post('/v1/auth/users', { preHandler: [session, adminOnly] }, async (req, reply) => {
    const b = (req.body ?? {}) as { email?: string; name?: string; password?: string; role?: DashboardRole };
    if (!b.email || !b.password) return reply.code(400).send({ error: 'missing_fields' });
    try {
      const user = await auth.createUser({
        email: b.email,
        name: b.name,
        password: b.password,
        role: b.role === 'admin' ? 'admin' : 'viewer',
      });
      return reply.code(201).send({ user });
    } catch (err) {
      if (handleAuthError(err, reply)) return;
      throw err;
    }
  });

  app.patch('/v1/auth/users/:id', { preHandler: [session, adminOnly] }, async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const b = (req.body ?? {}) as { isActive?: boolean; role?: DashboardRole; password?: string };
    try {
      let user;
      if (typeof b.isActive === 'boolean') user = await auth.setActive(id, b.isActive);
      if (b.role) user = await auth.setRole(id, b.role === 'admin' ? 'admin' : 'viewer');
      if (b.password) await auth.resetPassword(id, b.password);
      return reply.send({ user: user ?? null, ok: true });
    } catch (err) {
      if (handleAuthError(err, reply)) return;
      throw err;
    }
  });
}
