-- ============================================================================
-- PHASE K — Business Growth Intelligence, Multi-Van Command Centre &
-- Decision Support.
--
-- K1 AUDIT FINDINGS (summary — see docs/FOODTAXI-TECHNICAL-BASELINE.md §71
-- for the full write-up):
--   - `components/operations/OperationsSummary.tsx` + `/api/operations/summary`
--     (Phase C) is already the main dashboard's "today at a glance" tile
--     set (stock/wastage/POs/staff/vehicles/hygiene). Phase K's Command
--     Centre composes this alongside finance/CRM/route/customer-funnel
--     signals into one attention-first view — it does not replace or
--     duplicate it, and the tile set itself is reused as-is.
--   - Every domain already has its own authoritative composer function
--     (lib/finance/reports.ts's getManagementReport, lib/crm/retention.ts's
--     getRetentionSummary, lib/routes/analytics.ts's getAnomalies/
--     getDayOfWeekPerformance, lib/routes/demand.ts's getLoadingPlan). Phase
--     K calls into these directly rather than re-deriving any of these
--     figures a second way — this migration adds NO cached copy of
--     transactional data (K88), only genuinely new state: owner-set goals/
--     budgets, saved command-centre views, and the attention-item
--     open/acknowledged/resolved/dismissed workflow state (which does not
--     exist anywhere else — `notifications.is_read` is a simple 2-state
--     read flag, not this lifecycle).
--   - `purchase_order_items.unit_cost` (Phase C, one row per PO line,
--     immutable, timestamped via its parent purchase_order) is the
--     confirmed, line-level supplier-cost history K27 needs — reused
--     directly. `finance_documents.extraction_status` (Phase H) is
--     explicitly NOT treated as authoritative here (K27's "no unconfirmed
--     OCR as authoritative") — only RECEIVED/PARTIALLY_RECEIVED purchase
--     orders are read.
--   - `businesses.timezone` (Phase D) and `lib/automations/timezone.ts`
--     already give every business its own correctly-handled local
--     day/week boundary — reused for the comparison engine (K66), not
--     re-derived.
--   - No opaque health/performance score exists anywhere in the codebase
--     today (grepped) — Phase K must not introduce one (K7/FINAL SAFETY
--     CHECK) and does not.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- K23 — owner-configured operational targets. One active target per
-- (business_id, goal_type) at a time — a new one supersedes rather than
-- accumulating a history of stale targets, but old rows are kept
-- (is_active = false) for a simple audit trail rather than deleted.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_goals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  goal_type    TEXT NOT NULL CHECK (goal_type IN (
                 'revenue', 'wastage_ceiling_pct', 'hygiene_completion_pct',
                 'stockout_count_ceiling', 'repeat_customer_rate_pct'
               )),
  period       TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly')),
  target_value NUMERIC(12,2) NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_business_goals_active ON business_goals(business_id, goal_type) WHERE is_active = true;
ALTER TABLE business_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_goals_business" ON business_goals
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin())
  WITH CHECK (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

-- ----------------------------------------------------------------------------
-- K24 — simple monthly management budgets. K25's "distinguish budget,
-- recorded actual, committed PO and unpaid invoice, avoid double counting"
-- is deliberately NOT solved by storing more numbers here — budgeted_amount
-- is the only thing this table holds; actual/committed/unpaid are always
-- read live from their own authoritative tables at comparison time
-- (lib/commandCentre/budgets.ts).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_budgets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category        TEXT NOT NULL CHECK (category IN ('revenue', 'stock_purchasing', 'vehicle_maintenance', 'marketing')),
  period_start    DATE NOT NULL, -- first of the month this budget applies to
  budgeted_amount NUMERIC(12,2) NOT NULL,
  created_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, category, period_start)
);
ALTER TABLE business_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "business_budgets_business" ON business_budgets
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin())
  WITH CHECK (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

-- ----------------------------------------------------------------------------
-- K55-K58 — the attention-item lifecycle (OPEN/ACKNOWLEDGED/RESOLVED/
-- DISMISSED). Deliberately holds NO cached content (no title/body/metric
-- value) — only identity + workflow state — so it can never become a
-- second, driftable copy of the underlying data (K88). `dedupe_key` is a
-- deterministic string the command centre computes fresh every time
-- (e.g. 'low_stock:<stock_item_id>', 'overdue_invoice:<invoice_id>') and
-- is what makes reconciliation idempotent: the same live-detected issue
-- always maps to the same row, and dismissing it (K57: "must not falsely
-- resolve the underlying issue") only hides it from the attention list —
-- it never touches the real stock/invoice/hygiene/vehicle record. Real
-- resolution (K58) is detected by the underlying condition simply no
-- longer being present in the freshly-computed exception list on the next
-- load — see lib/commandCentre/attention.ts's reconcileAttentionItems().
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attention_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  van_id         UUID REFERENCES vans(id) ON DELETE CASCADE,
  dedupe_key     TEXT NOT NULL,
  category       TEXT NOT NULL, -- 'stock' | 'hygiene' | 'vehicle' | 'staff' | 'finance' | 'route' | 'customer' | 'event'
  priority       TEXT NOT NULL CHECK (priority IN ('INFO', 'ACTION', 'IMPORTANT', 'CRITICAL')),
  state          TEXT NOT NULL DEFAULT 'OPEN' CHECK (state IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED')),
  first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  state_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  state_changed_by UUID REFERENCES users(id),
  resolved_reason  TEXT, -- 'auto: condition no longer detected' | 'manual: <what actually changed>'
  UNIQUE (business_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_attention_items_business_state ON attention_items(business_id, state);
ALTER TABLE attention_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attention_items_business" ON attention_items
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin())
  WITH CHECK (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

-- ----------------------------------------------------------------------------
-- K53 — simple saved filters (e.g. "Van 45 Today", "Finance This Month").
-- Deliberately just a named filter-parameter bundle, not a BI-builder
-- definition (K53 explicitly: "do not build a full BI dashboard builder").
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS command_centre_saved_views (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_by  UUID NOT NULL REFERENCES users(id),
  name        TEXT NOT NULL,
  filters     JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"van_id":"...","section":"stock","range":"this_week"}
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE command_centre_saved_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "command_centre_saved_views_business" ON command_centre_saved_views
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin())
  WITH CHECK (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());
