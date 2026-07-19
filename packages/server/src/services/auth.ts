import { hashPassword, verifyPassword } from '../domain/password.js';
import { signToken, type SessionClaims } from '../domain/token.js';
import * as repo from '../repositories/dashboardUsers.js';
import type { DashboardRole, DashboardUser } from '../repositories/dashboardUsers.js';

export class AuthError extends Error {
  constructor(
    public code: 'invalid_credentials' | 'inactive' | 'email_taken' | 'not_found' | 'weak_password',
    message: string,
  ) {
    super(message);
  }
}

export interface LoginResult {
  token: string;
  user: DashboardUser;
}

export async function login(
  email: string,
  password: string,
  secret: string,
): Promise<LoginResult> {
  const user = await repo.findByEmail(email);
  if (!user) throw new AuthError('invalid_credentials', 'invalid email or password');
  if (!user.is_active) throw new AuthError('inactive', 'account is deactivated');

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) throw new AuthError('invalid_credentials', 'invalid email or password');

  await repo.touchLogin(user.id);

  const claims: SessionClaims = {
    sub: String(user.id),
    email: user.email,
    role: user.role,
    name: user.name ?? undefined,
  };
  const token = signToken(claims, secret);
  const { password_hash, ...publicUser } = user;
  return { token, user: publicUser };
}

export async function createUser(input: {
  email: string;
  name?: string;
  password: string;
  role: DashboardRole;
}): Promise<DashboardUser> {
  if (input.password.length < 10) {
    throw new AuthError('weak_password', 'password must be at least 10 characters');
  }
  const existing = await repo.findByEmail(input.email);
  if (existing) throw new AuthError('email_taken', 'a user with this email already exists');

  const passwordHash = await hashPassword(input.password);
  return repo.createUser({
    email: input.email,
    name: input.name,
    passwordHash,
    role: input.role,
  });
}

export function listUsers() {
  return repo.listUsers();
}

export async function setActive(id: number, active: boolean): Promise<DashboardUser> {
  const user = await repo.findById(id);
  if (!user) throw new AuthError('not_found', 'user not found');
  await repo.setActive(id, active);
  return { ...user, is_active: active };
}

export async function setRole(id: number, role: DashboardRole): Promise<DashboardUser> {
  const user = await repo.findById(id);
  if (!user) throw new AuthError('not_found', 'user not found');
  await repo.setRole(id, role);
  return { ...user, role };
}

export async function resetPassword(id: number, password: string): Promise<void> {
  if (password.length < 10) {
    throw new AuthError('weak_password', 'password must be at least 10 characters');
  }
  const user = await repo.findById(id);
  if (!user) throw new AuthError('not_found', 'user not found');
  await repo.setPassword(id, await hashPassword(password));
}

/** Bootstrap helper: create the first admin if no users exist yet. */
export async function ensureFirstAdmin(input: {
  email: string;
  name?: string;
  password: string;
}): Promise<DashboardUser | null> {
  const count = await repo.countUsers();
  if (count > 0) return null;
  return createUser({ ...input, role: 'admin' });
}
