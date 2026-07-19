const API_BASE = import.meta.env.VITE_API_BASE ?? '';
const TOKEN_KEY = 'limechat_nps_token';

export interface SessionUser {
  sub: string;
  email: string;
  role: 'admin' | 'viewer';
  name?: string;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(email: string, password: string): Promise<SessionUser> {
  const res = await fetch(`${API_BASE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Invalid email or password');
  }
  const data = (await res.json()) as { token: string; user: SessionUser };
  setToken(data.token);
  return data.user;
}

/** Validate the stored token and return the current user, or null. */
export async function me(): Promise<SessionUser | null> {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    clearToken();
    return null;
  }
  const data = (await res.json()) as { user: SessionUser };
  return data.user;
}

export function logout() {
  clearToken();
}
