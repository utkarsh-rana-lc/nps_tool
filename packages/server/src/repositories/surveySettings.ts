import { query } from '../db.js';
import type { PoolClient } from 'pg';
import type { Product } from '../types.js';

export interface SurveySetting {
  product: Product;
  question: string;
  reason_prompt: string;
  updated_at?: string;
}

const DEFAULTS: Record<Product, { question: string; reasonPrompt: string }> = {
  crm: {
    question: 'How likely are you to recommend LimeChat CRM to a friend or colleague?',
    reasonPrompt: "What's the most important reason for your score?",
  },
  marketing: {
    question: 'How likely are you to recommend LimeChat Marketing to a friend or colleague?',
    reasonPrompt: "What's the most important reason for your score?",
  },
  bot: {
    question: 'How likely are you to recommend LimeChat Bot to a friend or colleague?',
    reasonPrompt: "What's the most important reason for your score?",
  },
};

export async function getAllSettings(): Promise<SurveySetting[]> {
  const { rows } = await query<SurveySetting>(
    `SELECT product, question, reason_prompt, updated_at FROM survey_settings ORDER BY product`,
  );
  return rows;
}

/**
 * Message for one product, using a client if inside a transaction. Always
 * resolves to something — falls back to the built-in defaults if the row is
 * somehow missing, so the widget never shows blank copy.
 */
export async function getSetting(
  product: Product,
  client?: PoolClient,
): Promise<{ question: string; reasonPrompt: string }> {
  const sql = `SELECT question, reason_prompt FROM survey_settings WHERE product = $1`;
  const res = client
    ? await client.query<{ question: string; reason_prompt: string }>(sql, [product])
    : await query<{ question: string; reason_prompt: string }>(sql, [product]);
  const row = res.rows[0];
  if (row) return { question: row.question, reasonPrompt: row.reason_prompt };
  return DEFAULTS[product];
}

export async function upsertSetting(
  product: Product,
  question: string,
  reasonPrompt: string,
): Promise<SurveySetting> {
  const { rows } = await query<SurveySetting>(
    `INSERT INTO survey_settings (product, question, reason_prompt)
       VALUES ($1, $2, $3)
     ON CONFLICT (product) DO UPDATE
       SET question = EXCLUDED.question, reason_prompt = EXCLUDED.reason_prompt
     RETURNING product, question, reason_prompt, updated_at`,
    [product, question, reasonPrompt],
  );
  return rows[0];
}
