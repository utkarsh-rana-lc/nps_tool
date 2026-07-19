import type { NpsConfig, EligibilityResponse } from './types.js';

const DEFAULT_BASE = 'https://nps.limechat.ai';

export async function checkEligibility(cfg: NpsConfig): Promise<EligibilityResponse> {
  const base = cfg.apiBase ?? DEFAULT_BASE;
  const params = new URLSearchParams({
    product: cfg.product,
    accountRef: cfg.account.id,
    email: cfg.user.email,
  });
  if (cfg.account.name) params.set('accountName', cfg.account.name);
  if (cfg.user.id) params.set('userRef', cfg.user.id);

  const res = await fetch(`${base}/v1/nps/eligibility?${params.toString()}`, {
    headers: { 'X-NPS-Write-Key': cfg.writeKey },
  });
  if (!res.ok) throw new Error(`eligibility failed: ${res.status}`);
  return res.json();
}

export async function submitResponse(
  cfg: NpsConfig,
  promptId: string,
  score: number,
  reason: string,
): Promise<void> {
  const base = cfg.apiBase ?? DEFAULT_BASE;
  const res = await fetch(`${base}/v1/nps/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-NPS-Write-Key': cfg.writeKey,
    },
    body: JSON.stringify({ promptId, score, reason }),
  });
  if (!res.ok && res.status !== 409) throw new Error(`submit failed: ${res.status}`);
}

export async function dismiss(cfg: NpsConfig, promptId: string): Promise<void> {
  const base = cfg.apiBase ?? DEFAULT_BASE;
  try {
    await fetch(`${base}/v1/nps/responses/${promptId}/dismiss`, {
      method: 'POST',
      headers: { 'X-NPS-Write-Key': cfg.writeKey },
      keepalive: true,
    });
  } catch {
    /* best-effort */
  }
}
