/**
 * Deterministic demo data: ~30 months of NPS across 8 accounts, 3 products.
 * Respects the once-per-user-per-product-per-month rule. Run: pnpm seed
 */
import { getPool, closePool } from './db.js';
import { categorize } from './domain/nps.js';
import { newId } from './domain/ids.js';
import { PRODUCTS } from './types.js';

// tiny seeded PRNG (mulberry32) so the demo is reproducible
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(42);

const ACCOUNTS = [
  { ref: 'acc_10432', name: 'Acme Retail', health: 0.75 },
  { ref: 'acc_10877', name: 'Nova Cosmetics', health: 0.62 },
  { ref: 'acc_11290', name: 'Peak Nutrition', health: 0.55 },
  { ref: 'acc_11845', name: 'Urban Threads', health: 0.40 },
  { ref: 'acc_12010', name: 'BlueCart Grocery', health: 0.68 },
  { ref: 'acc_12388', name: 'Zenith Electronics', health: 0.35 },
  { ref: 'acc_12701', name: 'Maple & Co', health: 0.80 },
  { ref: 'acc_13122', name: 'Coastal Pharma', health: 0.50 },
];

const MONTHS = 30; // trailing months ending this month

function scoreFor(health: number, productBias: number): number {
  // Category-first draw so the demo data has a realistic distribution
  // (healthy accounts land mostly 7–10). productBias nudges CRM up, Marketing down.
  const pPromoter = Math.min(0.75, Math.max(0.15, 0.34 + health * 0.36 + productBias * 0.06));
  const pDetractor = Math.min(0.6, Math.max(0.05, 0.3 - health * 0.24 - productBias * 0.05));
  const u = rand();
  if (u < pPromoter) return rand() < 0.5 ? 9 : 10;
  if (u < pPromoter + (1 - pPromoter - pDetractor)) return rand() < 0.5 ? 7 : 8;
  return 6 - Math.floor(rand() * rand() * 7); // detractor, skewed toward 4–6
}

function monthsBack(n: number): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - n);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

const REASONS = {
  promoter: [
    'Support team is fast and flows are reliable.',
    'The bot handles our peak volumes without breaking.',
    'Campaign delivery has been excellent this quarter.',
    'Onboarding was smooth and the team is responsive.',
  ],
  passive: [
    'Works well but reporting could be deeper.',
    'Good overall, a few features still missing.',
    'Solid, though pricing feels a bit high.',
    'Mostly happy, occasional latency on templates.',
  ],
  detractor: [
    'Too many delivery failures last month.',
    'Support responses have been slow lately.',
    'The dashboard is confusing for my team.',
    'Ran into repeated bugs during onboarding.',
  ],
};

async function main() {
  const pool = getPool();
  console.log('Seeding demo data…');

  for (const acc of ACCOUNTS) {
    const a = await pool.query<{ id: number }>(
      `INSERT INTO accounts (account_ref, name) VALUES ($1, $2)
       ON CONFLICT (account_ref) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [acc.ref, acc.name],
    );
    const accountId = a.rows[0].id;

    // 3–6 users per account
    const userCount = 3 + Math.floor(rand() * 4);
    const users: number[] = [];
    for (let u = 0; u < userCount; u++) {
      const email = `user${u + 1}@${acc.name.toLowerCase().replace(/[^a-z]/g, '')}.com`;
      const r = await pool.query<{ id: number }>(
        `INSERT INTO users (account_id, email, user_ref) VALUES ($1, $2, $3)
         ON CONFLICT (account_id, email) DO UPDATE SET user_ref = EXCLUDED.user_ref
         RETURNING id`,
        [accountId, email, `usr_${acc.ref}_${u + 1}`],
      );
      users.push(r.rows[0].id);
    }

    const productBias: Record<string, number> = { crm: 1.0, marketing: -0.5, bot: 0.3 };

    for (let mo = MONTHS; mo >= 0; mo--) {
      const period = monthsBack(mo);
      for (const product of PRODUCTS) {
        for (const userId of users) {
          // not everyone is active every month
          if (rand() > 0.55) continue;

          const promptId = newId('prm');
          const responded = rand() < 0.72; // response rate ~72%
          const createdAt = `${period.slice(0, 7)}-${String(2 + Math.floor(rand() * 24)).padStart(2, '0')}T10:00:00Z`;

          await pool.query(
            `INSERT INTO survey_prompts (id, user_id, account_id, product, period_month, status, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (user_id, product, period_month) DO NOTHING`,
            [promptId, userId, accountId, product, period, responded ? 'responded' : 'shown', createdAt],
          );
          if (!responded) continue;

          const score = scoreFor(acc.health, productBias[product]);
          const category = categorize(score);
          const reasonList = REASONS[category];
          const reason = reasonList[Math.floor(rand() * reasonList.length)];

          await pool.query(
            `INSERT INTO nps_responses
               (id, prompt_id, user_id, account_id, product, period_month, score, category, reason, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             ON CONFLICT (user_id, product, period_month) DO NOTHING`,
            [newId('res'), promptId, userId, accountId, product, period, score, category, reason, createdAt],
          );
        }
      }
    }
    console.log(`  ✓ ${acc.name}`);
  }

  console.log('Done.');
  await closePool();
}

main().catch(async (err) => {
  console.error(err);
  await closePool();
  process.exit(1);
});
