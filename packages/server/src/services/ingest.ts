import { withTransaction } from '../db.js';
import { categorize } from '../domain/nps.js';
import { periodLabel } from '../domain/period.js';
import { newId } from '../domain/ids.js';
import type { NpsCategory } from '../types.js';

export class IngestError extends Error {
  constructor(
    public code: 'prompt_not_found' | 'already_responded' | 'invalid_score',
    message: string,
  ) {
    super(message);
  }
}

export interface SubmitInput {
  promptId: string;
  score: number;
  reason?: string;
}

export interface SubmitResult {
  id: string;
  category: NpsCategory;
  period: string;
}

/** Record a score against an open prompt. Idempotent per (user,product,month). */
export async function submitResponse(input: SubmitInput): Promise<SubmitResult> {
  if (!Number.isInteger(input.score) || input.score < 0 || input.score > 10) {
    throw new IngestError('invalid_score', 'score must be an integer 0–10');
  }
  const category = categorize(input.score);

  return withTransaction(async (client) => {
    const prompt = await client.query<{
      user_id: number;
      account_id: number;
      product: string;
      period_month: string;
      status: string;
    }>(
      `SELECT user_id, account_id, product, period_month, status
         FROM survey_prompts WHERE id = $1 FOR UPDATE`,
      [input.promptId],
    );
    if (!prompt.rowCount) {
      throw new IngestError('prompt_not_found', 'unknown promptId');
    }
    const p = prompt.rows[0];

    const resId = newId('res');
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO nps_responses
         (id, prompt_id, user_id, account_id, product, period_month, score, category, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (user_id, product, period_month) DO NOTHING
       RETURNING id`,
      [
        resId,
        input.promptId,
        p.user_id,
        p.account_id,
        p.product,
        p.period_month,
        input.score,
        category,
        input.reason?.trim() || null,
      ],
    );

    if (!inserted.rowCount) {
      throw new IngestError('already_responded', 'already scored this period');
    }

    await client.query(
      `UPDATE survey_prompts SET status = 'responded' WHERE id = $1`,
      [input.promptId],
    );

    return { id: resId, category, period: periodLabel(p.period_month) };
  });
}

export async function dismissPrompt(promptId: string): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE survey_prompts SET status = 'dismissed'
        WHERE id = $1 AND status = 'shown'`,
      [promptId],
    );
  });
}
