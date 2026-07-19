import type { Filters, Summary, Timeseries, AccountRow, UserRow } from './types.js';
import { getToken, clearToken } from './auth.js';

// In dev, Vite proxies /v1 → localhost:4000. In prod, set VITE_API_BASE.
const API_BASE = import.meta.env.VITE_API_BASE ?? '';

function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function qs(filters: Filters, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams({ product: filters.product, ...extra });
  if (filters.dateFrom) p.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) p.set('dateTo', filters.dateTo);
  if (filters.accountRef) p.set('accountRef', filters.accountRef);
  return p.toString();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeader() });
  if (res.status === 401) {
    clearToken();
    window.location.reload();
  }
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

export const api = {
  summary: (f: Filters) => get<Summary>(`/v1/nps/analytics/summary?${qs(f)}`),
  timeseries: (f: Filters, groupByProduct = false) =>
    get<Timeseries>(`/v1/nps/analytics/timeseries?${qs(f, { groupByProduct: String(groupByProduct) })}`),
  accounts: (f: Filters, sort = 'nps', search = '') =>
    get<{ accounts: AccountRow[] }>(`/v1/nps/analytics/accounts?${qs(f, { sort, search })}`),
  accountUsers: (accountRef: string, f: Filters) =>
    get<{ accountRef: string; users: UserRow[] }>(
      `/v1/nps/analytics/accounts/${encodeURIComponent(accountRef)}/users?${qs({ ...f, accountRef: undefined })}`,
    ),
  exportAccountUrl: (accountRef: string, f: Filters) =>
    `${API_BASE}/v1/nps/export/accounts/${encodeURIComponent(accountRef)}.csv?${qs({ ...f, accountRef: undefined })}`,
  exportAllUrl: (f: Filters) => `${API_BASE}/v1/nps/export/all.csv?${qs(f)}`,

  // ── user management (admin only) ──
  listUsers: () => get<{ users: DashboardUserRow[] }>(`/v1/auth/users`),
  createUser: (input: { email: string; name?: string; password: string; role: 'admin' | 'viewer' }) =>
    post<{ user: DashboardUserRow }>(`/v1/auth/users`, input),
  updateUser: (id: number, patch: { isActive?: boolean; role?: 'admin' | 'viewer'; password?: string }) =>
    patchReq<{ ok: boolean }>(`/v1/auth/users/${id}`, patch),

  // ── survey message settings ──
  getSettings: () => get<{ settings: SurveySetting[] }>(`/v1/nps/settings`),
  updateSetting: (product: string, body: { question: string; reasonPrompt: string }) =>
    putReq<{ setting: SurveySetting }>(`/v1/nps/settings/${product}`, body),
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.message ?? `${path} → ${res.status}`);
  }
  return res.json();
}

async function patchReq<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

async function putReq<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.message ?? `${path} → ${res.status}`);
  }
  return res.json();
}

export interface SurveySetting {
  product: 'crm' | 'marketing' | 'bot';
  question: string;
  reasonPrompt: string;
  updatedAt?: string;
}

export interface DashboardUserRow {
  id: number;
  email: string;
  name: string | null;
  role: 'admin' | 'viewer';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

/** Download a CSV honoring the session auth header (can't use a plain <a href>). */
export async function downloadCsv(url: string, filename: string): Promise<void> {
  const res = await fetch(url, { headers: authHeader() });
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
