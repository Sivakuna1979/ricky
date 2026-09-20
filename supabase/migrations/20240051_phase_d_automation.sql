-- ============================================================================
-- PHASE D — Automation engine, notification centre, scheduled reports
-- ============================================================================
-- Additive and idempotent throughout. Reuses the existing `notifications`
-- table as-is (user_id-scoped, RLS already correct since 20240001/20240002)
-- rather than creating a parallel in-app notification system — category/
-- priority/action_url/business_id all fit in its existing `data` jsonb
-- column, so no columns are added to it.
-- ============================================================================

-- Business timezone (D28) — every existing business defaults to the UK,
-- which is what they all are today; a future non-UK business can set its
-- own. Used to compute "business-local now" for daily/weekly scheduling
-- and for bucketing "today"/"this week" in the new reports.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Europe/London';

-- ----------------------------------------------------------------------------
-- automation_settings — one row per (business, automation_type). Doubles as
-- both "is this automation on" (D2/D26) and its configuration/channels
-- (D7/D27) rather than two overlapping tables. Enabled defaults to false at
-- the database level; the app seeds sensible per-type defaults on first
-- read (see lib/automations/settings.ts) rather than encoding business
-- logic in a column default.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automation_settings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  automation_type TEXT NOT NULL,
  enabled        BOOLEAN NOT NULL DEFAULT false,
  channels       JSONB NOT NULL DEFAULT '{"in_app":true,"email":false,"sms":false,"whatsapp":false}'::jsonb,
  config         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, automation_type)
);
CREATE INDEX IF NOT EXISTS idx_automation_settings_business ON automation_settings(business_id);

-- ----------------------------------------------------------------------------
-- automation_runs — the execution log (D3) AND the idempotency mechanism
-- (D4). trigger_key is a deterministic, human-readable dedup key (e.g.
-- 'low_stock:{stock_item_id}:2026-09-20' or
-- 'vehicle_reminder:{van_id}:mot_expiry:14:2026-09-20'). The UNIQUE
-- constraint on (business_id, trigger_key) is what makes execution
-- exactly-once: an automation always attempts to INSERT its run row first
-- (ON CONFLICT DO NOTHING) and only proceeds with the action if that insert
-- actually happened — a retried cron tick, a duplicate webhook, or two
-- overlapping scheduler runs all hit the constraint and skip, not the
-- action logic itself (which is the safe way to do it — see
-- lib/automations/engine.ts).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automation_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  automation_type TEXT NOT NULL,
  trigger_key     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','RUNNING','COMPLETED','FAILED','SKIPPED')),
  action_taken    TEXT,
  result          JSONB,
  failure_reason  TEXT,
  executed_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, trigger_key)
);
CREATE INDEX IF NOT EXISTS idx_automation_runs_business_type ON automation_runs(business_id, automation_type, executed_at);
CREATE INDEX IF NOT EXISTS idx_automation_runs_status ON automation_runs(status) WHERE status = 'FAILED';

ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_settings_business" ON automation_settings;
CREATE POLICY "automation_settings_business" ON automation_settings
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "automation_runs_business" ON automation_runs;
CREATE POLICY "automation_runs_business" ON automation_runs
  FOR SELECT USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());
-- No write policy — automation_runs is only ever written by the cron/
-- automation routes using the service-role client (same pattern as
-- stock_movements in Phase C).

-- Indexes Phase D's scheduled evaluators query by (D40) — avoid scanning
-- full history every run.
CREATE INDEX IF NOT EXISTS idx_shifts_business_van_date ON shifts(business_id, van_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_open ON time_entries(staff_id) WHERE clock_out_at IS NULL;
