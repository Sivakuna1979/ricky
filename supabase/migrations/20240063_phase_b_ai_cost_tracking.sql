-- ============================================================================
-- PHASE B — AI usage/cost tracking
-- ============================================================================
-- One row per Anthropic API call across every FoodTaxi AI feature (WhatsApp
-- order parsing, menu/brand/schedule scans, business assistant, event
-- discovery, finance document extraction, lead enrichment). Written by the
-- app's admin client right after each call resolves (success or failure),
-- never by the client/browser — so this table only ever sees server-side
-- writes, same trust model as automation_runs (20240051).
--
-- Costs here are ESTIMATES computed from a hand-maintained $/token table
-- (see lib/ai/pricing.ts), not a mirror of Anthropic's actual invoice — the
-- model ids in use are too new for any public pricing API to resolve
-- reliably. Good enough for relative cost/feature comparison and spend
-- trends, not for finance reconciliation.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_usage_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature               TEXT NOT NULL,              -- e.g. 'whatsapp_order_parse', 'menu_scan'
  model                 TEXT NOT NULL,               -- the model that actually served the call (message.model), not just the one requested — matters when a fallback kicked in
  input_tokens          INTEGER NOT NULL DEFAULT 0,
  output_tokens         INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens     INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd    NUMERIC(10, 6) NOT NULL DEFAULT 0,
  latency_ms            INTEGER NOT NULL DEFAULT 0,
  business_id           UUID REFERENCES businesses(id) ON DELETE SET NULL,  -- nullable: some features (e.g. admin-only event discovery) have no business context
  success               BOOLEAN NOT NULL DEFAULT true,
  error_message         TEXT,                        -- SDK/HTTP error text only (never request/response bodies, never API keys)
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_log_created_at ON ai_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_feature ON ai_usage_log(feature);
CREATE INDEX IF NOT EXISTS idx_ai_usage_log_business ON ai_usage_log(business_id);

ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Platform-wide AI spend is the SaaS owner's cost, not any one business's —
-- only super_admin can read it. All writes go through the admin (service
-- role) client, which bypasses RLS entirely, so no insert policy is needed.
CREATE POLICY "ai_usage_log_super_admin_read" ON ai_usage_log
  FOR SELECT USING (is_super_admin());
