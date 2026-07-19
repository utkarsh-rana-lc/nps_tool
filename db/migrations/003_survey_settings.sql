-- LimeChat NPS — editable survey messages (per product), admin-managed.

BEGIN;

CREATE TABLE survey_settings (
  product        nps_product PRIMARY KEY,
  question       TEXT NOT NULL,
  reason_prompt  TEXT NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_survey_settings_touch BEFORE UPDATE ON survey_settings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Sensible defaults so the widget always has copy to show.
INSERT INTO survey_settings (product, question, reason_prompt) VALUES
  ('crm',       'How likely are you to recommend LimeChat CRM to a friend or colleague?',       'What''s the most important reason for your score?'),
  ('marketing', 'How likely are you to recommend LimeChat Marketing to a friend or colleague?', 'What''s the most important reason for your score?'),
  ('bot',       'How likely are you to recommend LimeChat Bot to a friend or colleague?',       'What''s the most important reason for your score?');

COMMIT;
