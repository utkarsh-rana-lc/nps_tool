export type Product = 'crm' | 'marketing' | 'bot';
export type ProductFilter = Product | 'all';

export interface Filters {
  product: ProductFilter;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;
  accountRef?: string;
}

export interface Summary {
  nps: number | null;
  previousNps: number | null;
  delta: number | null;
  responses: number;
  prompts: number;
  responseRate: number | null;
  breakdown: {
    promoters: { count: number; pct: number };
    passives: { count: number; pct: number };
    detractors: { count: number; pct: number };
  };
  rating: 'needs_attention' | 'good' | 'excellent' | 'world_class' | null;
}

export interface TimePoint {
  period: string;
  nps: number | null;
  responses: number;
}

export interface Timeseries {
  granularity: 'month';
  points: TimePoint[];
  byProduct?: Record<Product, TimePoint[]>;
}

export interface AccountRow {
  accountRef: string;
  accountName: string | null;
  nps: number | null;
  responses: number;
  promoters: number;
  passives: number;
  detractors: number;
  latestScore: number | null;
  latestAt: string | null;
  byProduct: Record<Product, number | null>;
}

export interface UserRow {
  email: string;
  userRef: string | null;
  product: Product;
  period: string;
  score: number;
  category: string;
  reason: string | null;
  respondedAt: string;
}
