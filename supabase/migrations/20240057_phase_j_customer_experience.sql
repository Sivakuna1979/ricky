-- ============================================================================
-- PHASE J — Customer Ordering Experience, PWA, Push Notifications & Digital
-- Menu Experience.
--
-- J1 AUDIT FINDINGS (summary — see docs/FOODTAXI-TECHNICAL-BASELINE.md §70
-- for the full write-up):
--   - No PWA artifacts (manifest/service worker/icons) existed at all.
--   - No push-notification infrastructure existed at all.
--   - `customers` (id, user_id -> users.id) already exists but is almost
--     entirely unused: nothing ever inserts a row into it, and
--     `customer_favourite_vans` (keyed on customers.id) has no reader or
--     writer anywhere in the app. Rather than inventing a competing
--     "customer account" identity table, Phase J REUSES `customers` as the
--     one authenticated-customer identity, lazily creating a row the first
--     time a signed-in 'customer'-role user needs one (see
--     lib/customer/identity.ts). This also means `customer_favourite_vans`
--     and the pre-existing `orders.customer_id` FK (already nullable, see
--     20240033_pos_orders.sql) can be used exactly as originally designed
--     — no new "customer account" table, no new order-linkage column.
--   - Guest orders (the dominant order path) have never set
--     `orders.customer_id` and have no cross-visit browser identity at all
--     (confirmed: no cookie/localStorage identity token exists). Phase J
--     does not change this for anonymous guests — favourites/order-history/
--     reorder all require a real (free, low-friction) sign-in, consistent
--     with "do not force account creation for ordinary guest ordering"
--     (J7) while making the signed-in path genuinely useful.
--   - `van_schedule.id` is already the canonical "stop template" identity
--     (per Phase G's own audit comment), so J15 (favourite stops) can
--     reference it directly.
--   - `route_sessions` / `route_session_stops` (Phase G) already separate
--     SCHEDULED (van_schedule) from ACTUAL (actual_arrival_at/
--     actual_departure_at) stop times — Phase J's live-status widget reads
--     these rather than inventing a second notion of "current stop".
--   - `vans.accepts_online_orders` (boolean, pre-existing) is reused as the
--     ORDERING OPEN/CLOSED signal (J29) rather than adding a new column.
--   - `vans.tracking_status` (live/paused/offline, pre-existing) plus the
--     existing 90-second GPS-staleness check already in
--     components/map/LiveVanTracker.tsx are reused for LIVE NOW (J29/J32)
--     rather than re-deriving freshness a second way.
--
-- This migration is purely additive: new tables only, one new nullable
-- index-only convenience index, no destructive changes, no data loss.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- J13/J14 — favourite items/stops, mirroring the shape and RLS pattern of
-- the pre-existing (but previously unused) customer_favourite_vans.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_favourite_items (
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  menu_item_id  UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (customer_id, menu_item_id)
);
ALTER TABLE customer_favourite_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favourite_items_own" ON customer_favourite_items
  FOR ALL USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth_user_id()))
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth_user_id()));

-- J15 — stops, keyed on the canonical van_schedule row, never on free-text
-- pickup_location (which is not a reliable identity, per the phase brief).
CREATE TABLE IF NOT EXISTS customer_favourite_stops (
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  stop_id       UUID NOT NULL REFERENCES van_schedule(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (customer_id, stop_id)
);
ALTER TABLE customer_favourite_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "favourite_stops_own" ON customer_favourite_stops
  FOR ALL USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth_user_id()))
  WITH CHECK (customer_id IN (SELECT id FROM customers WHERE user_id = auth_user_id()));

-- Helpful now that customer_favourite_vans finally has a real reader/writer.
CREATE INDEX IF NOT EXISTS idx_customer_favourite_vans_customer ON customer_favourite_vans(customer_id);

-- ----------------------------------------------------------------------------
-- J8 — guest -> account continuity. Records a claim so it is auditable and
-- never silently repeatable in a way that could mis-attribute orders; the
-- actual matching rule (exact, case-insensitive guest_email match against
-- the signed-in customer's verified auth email) lives in application code
-- (lib/customer/identity.ts), never inferred from name similarity.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_guest_email_lower ON orders(lower(guest_email));

-- ----------------------------------------------------------------------------
-- J35-J38 — Web push. Subscriptions are written only by server-side API
-- routes using the service-role client (same pattern already used by
-- app/api/orders/guest for guest writes) — never directly by the browser's
-- anon-key client — so RLS below is deliberately deny-all for anon/
-- authenticated and only the service role (which bypasses RLS entirely)
-- can read/write. This is the simplest way to guarantee J37 ("push
-- subscriptions are sensitive identifiers... store securely") without
-- hand-writing a public policy that could be gotten subtly wrong.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID REFERENCES customers(id) ON DELETE CASCADE, -- NULL = guest subscription (J35 allows subscribing without an account)
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  van_id         UUID REFERENCES vans(id) ON DELETE CASCADE,
  -- Set when this browser subscribed for updates on ONE specific order
  -- (the common guest case: "notify me when my order's ready"). Order-ready
  -- pushes only ever target subscriptions with a matching order_id — never
  -- every subscriber to the van — so a guest who merely subscribed once
  -- never gets pushed about someone else's order.
  order_id       UUID REFERENCES orders(id) ON DELETE CASCADE,
  endpoint       TEXT NOT NULL UNIQUE,
  p256dh         TEXT NOT NULL,
  auth_key       TEXT NOT NULL,
  user_agent     TEXT,
  -- J36 — separately controllable notification types. Transactional
  -- (order updates) defaults on; everything else, including marketing,
  -- defaults OFF and requires explicit opt-in (mirrors Phase I's
  -- marketing_*_opt_in default-false convention).
  notify_order_updates          BOOLEAN NOT NULL DEFAULT true,
  notify_favourite_van_arrival  BOOLEAN NOT NULL DEFAULT false,
  notify_favourite_stop_reminder BOOLEAN NOT NULL DEFAULT false,
  notify_loyalty_reward         BOOLEAN NOT NULL DEFAULT false,
  notify_marketing_offers       BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at   TIMESTAMPTZ DEFAULT NOW(),
  disabled_at    TIMESTAMPTZ -- set when a push send returns 404/410 (Gone) — J35 "expired subscription cleanup"
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_business ON push_subscriptions(business_id) WHERE disabled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_van ON push_subscriptions(van_id) WHERE disabled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_customer ON push_subscriptions(customer_id) WHERE disabled_at IS NULL;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- No policies created deliberately: default-deny for anon/authenticated.
-- Only the service-role key (used exclusively from trusted API routes)
-- can read or write this table.

-- J38 — idempotent delivery, mirroring automation_runs.trigger_key exactly.
CREATE TABLE IF NOT EXISTS push_deliveries (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  trigger_key    TEXT NOT NULL,
  sent_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (subscription_id, trigger_key)
);
ALTER TABLE push_deliveries ENABLE ROW LEVEL SECURITY;
-- Same default-deny as push_subscriptions — service role only.

-- ----------------------------------------------------------------------------
-- J68/J69 — privacy-conscious funnel analytics. Deliberately minimal: no
-- persistent cross-session identity, no IP storage, no fingerprinting.
-- session_token is a random value the client generates and keeps only in
-- sessionStorage (cleared when the tab closes) purely to dedupe a single
-- funnel pass, never treated as a customer identity.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID REFERENCES businesses(id) ON DELETE CASCADE,
  van_id        UUID REFERENCES vans(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN (
                  'menu_view', 'cart_start', 'checkout_start', 'order_completed',
                  'install_prompt_shown', 'install_prompt_accepted', 'install_prompt_dismissed',
                  'reorder_used', 'loyalty_wallet_view', 'qr_scan'
                )),
  session_token TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_events_business_type_date ON customer_events(business_id, event_type, created_at);
ALTER TABLE customer_events ENABLE ROW LEVEL SECURITY;
-- Readable by the owning business/staff (funnel dashboard) and super admin;
-- writes go through a server API route using the service-role key (so an
-- anonymous visitor's browser session can never read another business's
-- funnel numbers).
CREATE POLICY "customer_events_business_read" ON customer_events
  FOR SELECT USING (
    business_id IN (SELECT my_business_ids())
    OR business_id IN (SELECT my_staff_business_ids())
    OR is_super_admin()
  );

-- ----------------------------------------------------------------------------
-- J28 — contextual QR foundation. Adds an optional context to the
-- pre-existing one-QR-per-van qr_codes table rather than a second QR
-- system: 'van' (the existing default, unchanged behaviour), 'stop' (a
-- specific van_schedule row — validated server-side on generation, and the
-- redirect route only ever uses it to pre-select that stop on the van
-- page, never to bypass the checkout's own stop validation), or 'board'
-- (redirects straight to the digital menu board).
-- ----------------------------------------------------------------------------
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS context TEXT NOT NULL DEFAULT 'van' CHECK (context IN ('van', 'stop', 'board'));
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS context_id UUID REFERENCES van_schedule(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS qr_codes_van_id_key; -- the old implicit one-per-van uniqueness, if it exists as an index
ALTER TABLE qr_codes DROP CONSTRAINT IF EXISTS qr_codes_van_id_key; -- ditto, if it exists as a table constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_codes_van_context ON qr_codes(van_id, context, COALESCE(context_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ----------------------------------------------------------------------------
-- J24 — the digital menu board's live updates. `vans` is already in the
-- realtime publication (migration3_functions_triggers.sql); menu_items and
-- menu_deals are not, so the board's Supabase Realtime subscription would
-- otherwise receive nothing. Guarded so re-running this migration (or a
-- table already added by hand) never errors.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'menu_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'menu_deals'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE menu_deals;
  END IF;
END $$;
