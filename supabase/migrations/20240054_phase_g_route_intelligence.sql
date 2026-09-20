-- ============================================================================
-- PHASE G — Route Intelligence, Stop Performance & Demand Planning
-- ============================================================================
-- G1 DATA AUDIT (performed before writing any of this — see
-- docs/FOODTAXI-TECHNICAL-BASELINE.md Phase G section for the full
-- write-up). Summary of what was found:
--
--   - orders.stop_id references the LEGACY route_stops table (superseded
--     by van_schedule since Phase A). Nothing in the app has ever written
--     to it. Not reused, not migrated — see below.
--   - orders.pickup_location is free TEXT. The public van ordering page
--     (app/van/[slug]/page.tsx) already resolves a real van_schedule row
--     when a customer picks a stop (a `pickupStop` object carrying its
--     real `id`) but was only ever sending pickupStop.location_name to
--     the order API — the real id was computed and then discarded.
--   - The WhatsApp ordering AI (app/api/webhooks/whatsapp/route.ts)
--     matches a customer's stated pickup against van_schedule.location_name
--     text and stores that text — also never resolving/storing the real
--     van_schedule.id.
--   - POS orders have no stop concept captured at all today.
--   - CONCLUSION: historical orders cannot be reliably attributed to a
--     specific stop. Per G57, this is not fixed retroactively — no
--     historical stop_id is guessed or fabricated. Stop-level analytics
--     is honestly scoped to "available from the date this migration's
--     application-code changes are deployed", not backfilled.
--   - Two Phase D automations and one Phase E AI tool were ALSO found, in
--     this same audit, to be querying van_schedule.day_of_week (0=Monday)
--     with a raw JavaScript getDay()/getUTCDay() value (0=Sunday) — a
--     genuine off-by-one bug, fixed in application code
--     (lib/schedule/dayOfWeek.ts) as part of this phase, not a schema
--     change.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- G2/G3/G4 — future order attribution. van_schedule.id is used AS-IS as
-- the canonical "stop template" identity — no competing stops table is
-- created. Both columns are nullable: an event order, a non-route
-- collection, or any special order legitimately has neither.
-- ----------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_stop_id UUID REFERENCES van_schedule(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_date DATE;
CREATE INDEX IF NOT EXISTS idx_orders_pickup_stop ON orders(pickup_stop_id);
CREATE INDEX IF NOT EXISTS idx_orders_service_date ON orders(van_id, service_date);

-- One-time, safe, non-destructive backfill for service_date ONLY (never
-- pickup_stop_id — that would mean guessing, forbidden by G57).
-- service_date = the calendar date of created_at is a reasonable, factual
-- default for every existing order (nothing is invented — it's the same
-- date the order genuinely happened on), and only fills rows that don't
-- have it set yet, so it's safe to run this migration more than once.
UPDATE orders SET service_date = created_at::date WHERE service_date IS NULL;


-- ----------------------------------------------------------------------------
-- G8/G9/G10 — route sessions: "the Friday route template" (van_schedule)
-- vs "what actually happened on this specific Friday" (route_sessions +
-- route_session_stops). One session per van per calendar day.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS route_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  van_id       UUID NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  started_at   TIMESTAMPTZ,
  started_by   UUID REFERENCES users(id),
  ended_at     TIMESTAMPTZ,
  ended_by     UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (van_id, service_date)
);
CREATE INDEX IF NOT EXISTS idx_route_sessions_business_date ON route_sessions(business_id, service_date);

-- One row per actual stop visit within a session. van_schedule_id is
-- nullable so an ad-hoc/unscheduled stop can still be recorded (G3's
-- "do not require a stop where it doesn't make sense" extended to
-- sessions too). scheduled_arrival/scheduled_departure/location_name are
-- copied from van_schedule AT SESSION START — deliberately denormalized
-- so a later edit to the schedule template never rewrites what a
-- historical session actually recorded (same principle as order_items
-- already denormalising menu item name/price in Phase A/B).
CREATE TABLE IF NOT EXISTS route_session_stops (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_session_id    UUID NOT NULL REFERENCES route_sessions(id) ON DELETE CASCADE,
  van_schedule_id     UUID REFERENCES van_schedule(id) ON DELETE SET NULL,
  sequence            INTEGER NOT NULL DEFAULT 0,
  location_name       TEXT NOT NULL,
  scheduled_arrival    TEXT,
  scheduled_departure  TEXT,
  actual_arrival_at    TIMESTAMPTZ,
  actual_departure_at  TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'arrived', 'departed', 'skipped')),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_route_session_stops_session ON route_session_stops(route_session_id, sequence);

ALTER TABLE route_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_session_stops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "route_sessions_business" ON route_sessions;
CREATE POLICY "route_sessions_business" ON route_sessions
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "route_session_stops_business" ON route_session_stops;
CREATE POLICY "route_session_stops_business" ON route_session_stops
  FOR ALL USING (
    route_session_id IN (SELECT id FROM route_sessions WHERE business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()))
    OR is_super_admin()
  );


-- ----------------------------------------------------------------------------
-- G21–G24, G44, G45 — demand planning. One row per (van, stop template,
-- stock item, target date). Deliberately a single table: "the loading
-- plan for Van 45 on Friday" is just every demand_estimates row for that
-- (van_id, target_date) — no separate "plan" table. Feedback columns
-- (G45) are appended, never overwrite the original suggestion (G44 — "do
-- not rewrite old predictions after seeing actual results").
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS demand_estimates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  van_id            UUID NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  van_schedule_id   UUID REFERENCES van_schedule(id) ON DELETE SET NULL,
  target_date       DATE NOT NULL,
  stock_item_id     UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  method            TEXT NOT NULL DEFAULT 'comparable_days_average',
  sample_size       INTEGER NOT NULL DEFAULT 0,
  sample_values     JSONB, -- the actual historical quantities used — full transparency (G41)
  baseline_quantity NUMERIC(12,2),
  buffer_pct        NUMERIC(5,2) NOT NULL DEFAULT 0,
  suggested_quantity NUMERIC(12,2),
  -- Feedback (G45) — appended after the fact, never replacing the above.
  feedback_status   TEXT CHECK (feedback_status IN ('used', 'adjusted', 'ignored')),
  feedback_quantity NUMERIC(12,2),
  feedback_at       TIMESTAMPTZ,
  feedback_by       UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (van_id, target_date, stock_item_id)
);
CREATE INDEX IF NOT EXISTS idx_demand_estimates_business_date ON demand_estimates(business_id, target_date);

ALTER TABLE demand_estimates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "demand_estimates_business" ON demand_estimates;
CREATE POLICY "demand_estimates_business" ON demand_estimates
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());


-- ----------------------------------------------------------------------------
-- Indexes justified by the actual Phase G analytics queries (G60) —
-- revenue/order aggregation by van+date+status is already covered by
-- Phase B/C indexes; this adds what's specifically new here.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_route_session_stops_van_schedule ON route_session_stops(van_schedule_id);
