-- ============================================================================
-- PHASE A1 — SCHEMA RECONCILIATION
-- ============================================================================
-- The application code diverged from the committed migration history in two
-- places, almost certainly because the underlying tables were originally
-- created or altered directly in the Supabase SQL editor rather than through
-- a committed migration file. This migration closes that gap so that running
-- every migration in this folder against a brand-new database reproduces the
-- schema the live application actually expects.
--
-- Everything below is additive and idempotent (IF NOT EXISTS / DROP POLICY
-- IF EXISTS + CREATE POLICY). Nothing here drops a table, drops a column,
-- renames anything, or deletes data. Where a column already exists live,
-- these statements are no-ops.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. menu_items — the app uses a flat van_id + category(text) + available
--    shape, not the original menus -> menu_categories -> menu_items(category_id)
--    relational design from 20240001_initial_schema.sql. Both shapes are
--    reconciled here: the new columns the app actually uses are added, and
--    category_id (still present, unused by the app) is made optional instead
--    of required, since nothing populates it anymore.
-- ----------------------------------------------------------------------------
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS van_id UUID REFERENCES vans(id) ON DELETE CASCADE;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT true;

-- category_id was NOT NULL in the original schema; the active code path
-- (dashboard/menu, POS, WhatsApp ordering, menu import/scan) never sets it,
-- so it must already be nullable in production for inserts to be succeeding
-- today. This documents that reality rather than changing behaviour.
ALTER TABLE menu_items ALTER COLUMN category_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_menu_items_van_id ON menu_items(van_id);

-- RLS for the van_id-based shape. The pre-existing menu_items_owner_all /
-- menu_items_public_read policies (migration2_part_b.sql) are keyed off the
-- legacy category_id -> menu_categories -> menus -> van_id chain and no
-- longer match real rows (which have category_id = NULL), so in practice
-- they currently grant nothing on the live data. Adding van_id-based
-- policies alongside them (not replacing) restores real enforcement without
-- risk of narrowing existing access.
DROP POLICY IF EXISTS "menu_items_owner_all_by_van" ON menu_items;
CREATE POLICY "menu_items_owner_all_by_van" ON menu_items
  FOR ALL USING (van_id IN (SELECT my_van_ids()) OR is_super_admin())
  WITH CHECK (van_id IN (SELECT my_van_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "menu_items_public_read_by_van" ON menu_items;
CREATE POLICY "menu_items_public_read_by_van" ON menu_items
  FOR SELECT USING (available = true);


-- ----------------------------------------------------------------------------
-- 2. event_requests / event_applications / event_blocked_dates — referenced
--    and ALTERed by 20240028/20240029/20240032, but never CREATEd in any
--    committed migration. Columns below are reconstructed from every actual
--    usage across app/api/events/**. IF NOT EXISTS makes this a no-op against
--    the live table, which already exists (the Events feature works today).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- customer-submitted contact details
  name                TEXT,
  phone               TEXT,
  email               TEXT,
  -- event details
  event_date          DATE,
  event_time          TEXT,
  event_location      TEXT,
  event_type          TEXT,
  food_type           TEXT,
  num_guests          INTEGER,
  budget              TEXT,
  notes               TEXT,
  preferred_van       TEXT,
  region              TEXT,
  postcode            TEXT,
  lat                 DOUBLE PRECISION,
  lng                 DOUBLE PRECISION,
  -- FoodTaxi/marketplace workflow
  source              TEXT DEFAULT 'customer',      -- customer | foodtaxi
  admin_status        TEXT DEFAULT 'new',           -- new | reviewing | published | vans_interested | confirmed | awaiting_deposit | completed | cancelled
  customer_status     TEXT DEFAULT 'request_sent',
  marketplace_visible BOOLEAN DEFAULT false,
  organiser_approved  BOOLEAN DEFAULT true,          -- customer-submitted requests are pre-approved; AI/staff-sourced start false
  urgent              BOOLEAN DEFAULT false,
  -- commercial terms
  foodtaxi_fee        NUMERIC(8,2) DEFAULT 29.99,
  commission_pct      NUMERIC(5,2),
  deposit_required     BOOLEAN DEFAULT false,
  deposit_amount      NUMERIC(10,2),
  deposit_paid        BOOLEAN DEFAULT false,
  payment_required    BOOLEAN DEFAULT true,
  total_amount        NUMERIC(10,2),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_requests_region ON event_requests(region);
CREATE INDEX IF NOT EXISTS idx_event_requests_market ON event_requests(marketplace_visible, event_date);

CREATE TABLE IF NOT EXISTS event_applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES event_requests(id) ON DELETE CASCADE,
  van_owner_name    TEXT,
  van_owner_email   TEXT NOT NULL,
  business_name     TEXT,
  status            TEXT DEFAULT 'interested',   -- interested | confirmed | declined
  notes             TEXT,
  fee               NUMERIC(8,2),
  stripe_session_id TEXT,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (event_id, van_owner_email)
);
CREATE INDEX IF NOT EXISTS idx_event_applications_event ON event_applications(event_id);

CREATE TABLE IF NOT EXISTS event_blocked_dates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_date DATE NOT NULL UNIQUE,
  reason       TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- RLS — every event_requests/event_applications/event_blocked_dates read and
-- write in the app goes through server routes using the service-role key
-- (confirmed: no browser/anon-key usage of these tables anywhere in the
-- codebase), so enabling RLS here only closes a gap where these tables could
-- otherwise be reached directly with the public anon key; it does not change
-- how the app itself behaves.
ALTER TABLE event_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_blocked_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_requests_admin" ON event_requests;
CREATE POLICY "event_requests_admin" ON event_requests FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "event_applications_admin" ON event_applications;
CREATE POLICY "event_applications_admin" ON event_applications FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "event_blocked_dates_admin" ON event_blocked_dates;
CREATE POLICY "event_blocked_dates_admin" ON event_blocked_dates FOR ALL USING (is_super_admin());


-- ----------------------------------------------------------------------------
-- 3. Legacy structures — NOT dropped in Phase A. Documented here for anyone
--    reading migration history so it's clear these are dead, not just old:
--
--    - menus, menu_categories, menu_item_options, menu_item_option_choices
--      (20240001_initial_schema.sql): superseded by menu_items.van_id above.
--      Still present, unused by any active code path.
--    - components/menu/MenuBuilder.tsx, components/menu/MenuItemForm.tsx:
--      write to the legacy category_id/is_available shape. Not imported by
--      any page — dead frontend code, not deleted in Phase A.
--    - customers table + orders.customer_id: orders.customer_id was made
--      nullable in 20240033_pos_orders.sql once guest/POS orders (which have
--      no customer account at all) were introduced. The customers table
--      still exists for any future logged-in customer accounts feature.
-- ----------------------------------------------------------------------------
