import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Minimal HS256 JWT (sign/verify) with no external dependency. Enough for a
 * first-party dashboard session token. Swap for a full JWT lib or an OIDC
 * provider later without changing call sites.
 */

export interface SessionClaims {
  sub: string;   // user id
  email: string;
  role: 'admin' | 'viewer';
  name?: string;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function b64urlJson(obj: unknown): string {
  return b64url(JSON.stringify(obj));
}

export function signToken(claims: SessionClaims, secret: string, ttlSeconds = 60 * 60 * 12): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { ...claims, iat: now, exp: now + ttlSeconds };
  const head = b64urlJson(header);
  const body = b64urlJson(payload);
  const sig = b64url(createHmac('sha256', secret).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}

export function verifyToken(token: string, secret: string): (SessionClaims & { exp: number }) | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [head, body, sig] = parts;
  const expected = b64url(createHmac('sha256', secret).update(`${head}.${body}`).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64').toString('utf8'));
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
