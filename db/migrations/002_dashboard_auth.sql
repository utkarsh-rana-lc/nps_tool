-- LimeChat NPS — dashboard access control
-- Operators who can sign in to the analytics dashboard.

BEGIN;

CREATE TYPE dashboard_role AS ENUM ('admin', 'viewer');

CREATE TABLE dashboard_users (
  id             BIGSERIAL PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  name           TEXT,
  password_hash  TEXT NOT NULL,           -- scrypt$N$r$p$salt$hash
  role           dashboard_role NOT NULL DEFAULT 'viewer',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dashboard_users_email ON dashboard_users (lower(email));

CREATE TRIGGER trg_dashboard_users_touch BEFORE UPDATE ON dashboard_users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

COMMIT;
