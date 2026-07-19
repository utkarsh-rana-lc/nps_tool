import type { NpsCategory, NpsBreakdown, NpsRating } from '../types.js';

/**
 * NPS categorisation per the standard definition:
 *   Promoters  = 9–10
 *   Passives   = 7–8
 *   Detractors = 0–6
 */
export function categorize(score: number): NpsCategory {
  if (!Number.isInteger(score) || score < 0 || score > 10) {
    throw new RangeError(`NPS score must be an integer 0–10, got ${score}`);
  }
  if (score >= 9) return 'promoter';
  if (score >= 7) return 'passive';
  return 'detractor';
}

export interface Counts {
  promoters: number;
  passives: number;
  detractors: number;
}

export function emptyCounts(): Counts {
  return { promoters: 0, passives: 0, detractors: 0 };
}

export function total(c: Counts): number {
  return c.promoters + c.passives + c.detractors;
}

/**
 * NPS = %Promoters − %Detractors, rounded to an integer in [-100, 100].
 * Passives count toward the denominator only. Returns null when no responses.
 */
export function npsScore(c: Counts): number | null {
  const n = total(c);
  if (n === 0) return null;
  return Math.round(((c.promoters - c.detractors) / n) * 100);
}

export function breakdown(c: Counts): NpsBreakdown {
  const n = total(c) || 1; // avoid /0; when n=0 all counts are 0 anyway
  return {
    promoters: { count: c.promoters, pct: c.promoters / n },
    passives: { count: c.passives, pct: c.passives / n },
    detractors: { count: c.detractors, pct: c.detractors / n },
  };
}

/**
 * Qualitative rating band, matching the common global benchmarks:
 *   < 0    needs_attention (more detractors than promoters)
 *   0–49   good
 *   50–69  excellent
 *   70+    world_class
 */
export function rating(nps: number | null): NpsRating | null {
  if (nps === null) return null;
  if (nps < 0) return 'needs_attention';
  if (nps < 50) return 'good';
  if (nps < 70) return 'excellent';
  return 'world_class';
}
