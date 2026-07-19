import { query } from '../db.js';

export type DashboardRole = 'admin' | 'viewer';

export interface DashboardUser {
  id: number;
  email: string;
  name: string | null;
  role: DashboardRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface DashboardUserWithHash extends DashboardUser {
  password_hash: string;
}

const PUBLIC_COLS =
  'id, email, name, role, is_active, last_login_at, created_at';

export async function findByEmail(email: string): Promise<DashboardUserWithHash | null> {
  const { rows } = await query<DashboardUserWithHash>(
    `SELECT ${PUBLIC_COLS}, password_hash FROM dashboard_users WHERE lower(email) = lower($1)`,
    [email],
  );
  return rows[0] ?? null;
}

export async function findById(id: number): Promise<DashboardUser | null> {
  const { rows } = await query<DashboardUser>(
    `SELECT ${PUBLIC_COLS} FROM dashboard_users WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function createUser(input: {
  email: string;
  name?: string;
  passwordHash: string;
  role: DashboardRole;
}): Promise<DashboardUser> {
  const { rows } = await query<DashboardUser>(
    `INSERT INTO dashboard_users (email, name, password_hash, role)
       VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_COLS}`,
    [input.email.toLowerCase(), input.name ?? null, input.passwordHash, input.role],
  );
  return rows[0];
}

export async function listUsers(): Promise<DashboardUser[]> {
  const { rows } = await query<DashboardUser>(
    `SELECT ${PUBLIC_COLS} FROM dashboard_users ORDER BY created_at ASC`,
  );
  return rows;
}

export async function setActive(id: number, active: boolean): Promise<void> {
  await query(`UPDATE dashboard_users SET is_active = $2 WHERE id = $1`, [id, active]);
}

export async function setRole(id: number, role: DashboardRole): Promise<void> {
  await query(`UPDATE dashboard_users SET role = $2 WHERE id = $1`, [id, role]);
}

export async function setPassword(id: number, passwordHash: string): Promise<void> {
  await query(`UPDATE dashboard_users SET password_hash = $2 WHERE id = $1`, [id, passwordHash]);
}

export async function touchLogin(id: number): Promise<void> {
  await query(`UPDATE dashboard_users SET last_login_at = now() WHERE id = $1`, [id]);
}

export async function countUsers(): Promise<number> {
  const { rows } = await query<{ n: string }>(`SELECT COUNT(*) AS n FROM dashboard_users`);
  return Number(rows[0].n);
}
