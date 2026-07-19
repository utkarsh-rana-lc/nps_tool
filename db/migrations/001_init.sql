-- LimeChat NPS — initial schema
-- Postgres 14+

BEGIN;

-- Products we collect NPS for.
CREATE TYPE nps_product AS ENUM ('crm', 'marketing', 'bot');

-- Derived NPS bucket. Denormalised onto each response for cheap slicing.
CREATE TYPE nps_category AS ENUM ('promoter', 'passive', 'detractor');

CREATE TYPE prompt_status AS ENUM ('shown', 'responded', 'dismissed');

-- ── accounts ────────────────────────────────────────────────────────────────
-- One row per LimeChat account. account_ref is the platform's unique account id.
CREATE TABLE accounts (
  id           BIGSERIAL PRIMARY KEY,
  account_ref  TEXT NOT NULL UNIQUE,
  name         TEXT,
  timezone     TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── users ───────────────────────────────────────────────────────────────────
-- The people we survey. Unique per (account, email).
CREATE TABLE users (
  id           BIGSERIAL PRIMARY KEY,
  account_id   BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  user_ref     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, email)
);

-- ── survey_prompts ──────────────────────────────────────────────────────────
-- The throttle ledger: one row every time a user is asked, per product per month.
-- period_month is pinned to the first of the month (account timezone).
CREATE TABLE survey_prompts (
  id            TEXT PRIMARY KEY,                      -- prm_...
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id    BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product       nps_product NOT NULL,
  period_month  DATE NOT NULL,                         -- e.g. 2026-07-01
  status        prompt_status NOT NULL DEFAULT 'shown',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Core cadence guarantee: at most one prompt per user/product/month.
  UNIQUE (user_id, product, period_month)
);

-- ── nps_responses ───────────────────────────────────────────────────────────
CREATE TABLE nps_responses (
  id            TEXT PRIMARY KEY,                      -- res_...
  prompt_id     TEXT NOT NULL REFERENCES survey_prompts(id) ON DELETE CASCADE,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id    BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product       nps_product NOT NULL,
  period_month  DATE NOT NULL,
  score         SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 10),
  category      nps_category NOT NULL,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One score per user/product/month, even under concurrent submits.
  UNIQUE (user_id, product, period_month)
);

-- ── indexes for analytics ────────────────────────────────────────────────────
CREATE INDEX idx_responses_period        ON nps_responses (period_month);
CREATE INDEX idx_responses_product_period ON nps_responses (product, period_month);
CREATE INDEX idx_responses_account        ON nps_responses (account_id, period_month);
CREATE INDEX idx_prompts_period           ON survey_prompts (product, period_month);
CREATE INDEX idx_users_account            ON users (account_id);

-- keep updated_at fresh
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_accounts_touch BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_users_touch BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_prompts_touch BEFORE UPDATE ON survey_prompts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
