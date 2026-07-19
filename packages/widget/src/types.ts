export type Product = 'crm' | 'marketing' | 'bot';

export interface NpsConfig {
  writeKey: string;
  product: Product;
  account: { id: string; name?: string };
  user: { email: string; id?: string };
  auto?: boolean;
  showDelayMs?: number;
  apiBase?: string;
  position?: 'bottom-right' | 'bottom-left' | 'center';
  accentColor?: string;
  onSubmit?: (payload: { score: number; reason: string }) => void;
  onDismiss?: () => void;
}

export interface EligibilityResponse {
  eligible: boolean;
  promptId: string | null;
  period: string;
  reason: string | null;
  // Admin-configured copy (present when eligible). Widget falls back to defaults.
  question?: string;
  reasonPrompt?: string;
}
