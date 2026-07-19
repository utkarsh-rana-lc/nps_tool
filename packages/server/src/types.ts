export type Product = 'crm' | 'marketing' | 'bot';
export const PRODUCTS: Product[] = ['crm', 'marketing', 'bot'];

export function isProduct(v: unknown): v is Product {
  return typeof v === 'string' && (PRODUCTS as string[]).includes(v);
}

export type NpsCategory = 'promoter' | 'passive' | 'detractor';

export interface AnalyticsFilters {
  product?: Product | 'all';
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  accountRef?: string;
}

export interface NpsBreakdown {
  promoters: { count: number; pct: number };
  passives: { count: number; pct: number };
  detractors: { count: number; pct: number };
}

export type NpsRating = 'needs_attention' | 'good' | 'excellent' | 'world_class';
