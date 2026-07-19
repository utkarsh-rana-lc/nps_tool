import { describe, it, expect } from 'vitest';
import { categorize, npsScore, rating, breakdown, type Counts } from './nps.js';

describe('categorize', () => {
  it('buckets scores per the NPS definition', () => {
    expect(categorize(10)).toBe('promoter');
    expect(categorize(9)).toBe('promoter');
    expect(categorize(8)).toBe('passive');
    expect(categorize(7)).toBe('passive');
    expect(categorize(6)).toBe('detractor');
    expect(categorize(0)).toBe('detractor');
  });
  it('rejects out-of-range or non-integer scores', () => {
    expect(() => categorize(11)).toThrow();
    expect(() => categorize(-1)).toThrow();
    expect(() => categorize(7.5)).toThrow();
  });
});

describe('npsScore', () => {
  it('matches the worked example: 57% promoters, 23% passive, 20% detractors → 37', () => {
    // 57/23/20 out of 100
    const c: Counts = { promoters: 57, passives: 23, detractors: 20 };
    expect(npsScore(c)).toBe(37);
  });
  it('is 100 when all promoters, -100 when all detractors', () => {
    expect(npsScore({ promoters: 5, passives: 0, detractors: 0 })).toBe(100);
    expect(npsScore({ promoters: 0, passives: 0, detractors: 5 })).toBe(-100);
  });
  it('returns null with no responses', () => {
    expect(npsScore({ promoters: 0, passives: 0, detractors: 0 })).toBeNull();
  });
});

describe('rating', () => {
  it('bands scores', () => {
    expect(rating(-5)).toBe('needs_attention');
    expect(rating(0)).toBe('good');
    expect(rating(49)).toBe('good');
    expect(rating(50)).toBe('excellent');
    expect(rating(69)).toBe('excellent');
    expect(rating(70)).toBe('world_class');
    expect(rating(null)).toBeNull();
  });
});

describe('breakdown', () => {
  it('computes percentages that sum to 1', () => {
    const b = breakdown({ promoters: 57, passives: 23, detractors: 20 });
    const sum = b.promoters.pct + b.passives.pct + b.detractors.pct;
    expect(sum).toBeCloseTo(1, 5);
  });
});
