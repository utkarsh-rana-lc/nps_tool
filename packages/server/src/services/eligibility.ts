import { withTransaction } from '../db.js';
import { upsertAccount, upsertUser } from '../repositories/identity.js';
import { currentPeriodMonth, periodLabel } from '../domain/period.js';
import { newId } from '../domain/ids.js';
import type { Product } from '../types.js';

export interface EligibilityInput {
  product: Product;
  accountRef: string;
  accountName?: string;
  email: string;
  userRef?: string;
}

export interface EligibilityResult {
  eligible: boolean;
  promptId: string | null;
  period: string; // YYYY-MM
  reason: 'already_prompted_this_month' | null;
}

/**
 * Server-authoritative "once per user, per product, per month" decision.
 *
 * If the user is due, we OPEN the prompt inside the same transaction and return
 * its id. Creating the prompt at decision time is what makes the throttle
 * race-safe: two concurrent tabs cannot both be told "yes" because the unique
 * (user, product, period_month) constraint lets exactly one INSERT win.
 */
export async function checkEligibility(
  input: EligibilityInput,
): Promise<EligibilityResult> {
  return withTransaction(async (client) => {
    const account = await upsertAccount(client, input.accountRef, input.accountName);
    const user = await upsertUser(client, account.id, input.email, input.userRef);
    const periodMonth = currentPeriodMonth(account.timezone);
    const period = periodLabel(periodMonth);

    // Has this user already been prompted for this product this month?
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM survey_prompts
        WHERE user_id = $1 AND product = $2 AND period_month = $3`,
      [user.id, input.product, periodMonth],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      return {
        eligible: false,
        promptId: null,
        period,
        reason: 'already_prompted_this_month',
      };
    }

    // Open the prompt. ON CONFLICT DO NOTHING absorbs the race; if we lose it,
    // someone else just prompted this exact slot, so we report not-eligible.
    const promptId = newId('prm');
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO survey_prompts (id, user_id, account_id, product, period_month, status)
         VALUES ($1, $2, $3, $4, $5, 'shown')
       ON CONFLICT (user_id, product, period_month) DO NOTHING
       RETURNING id`,
      [promptId, user.id, account.id, input.product, periodMonth],
    );

    if (!inserted.rowCount) {
      return {
        eligible: false,
        promptId: null,
        period,
        reason: 'already_prompted_this_month',
      };
    }

    return { eligible: true, promptId, period, reason: null };
  });
}
