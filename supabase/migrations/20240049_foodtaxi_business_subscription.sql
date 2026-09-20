-- ============================================================================
-- PHASE B1/B2/B3/B11 — FoodTaxi Business subscription
-- ============================================================================
-- Everything below is additive and idempotent. Nothing here drops a table,
-- drops a column, deletes a row, or renames anything. Existing
-- subscription_plans rows (Starter/Pro/Enterprise) are deactivated, not
-- deleted, since nothing in Phase B uses multi-tier plans any more.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Single FoodTaxi Business plan (£19.99/mo, 3-day trial). The
--    subscription_plans/subscriptions tables already existed
--    (20240001_initial_schema.sql) but were never wired up — see
--    docs/foodtaxi-database.md. Reused as-is; no new tables for billing.
-- ----------------------------------------------------------------------------
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, max_vans, features, is_active)
SELECT 'FoodTaxi Business', 'Everything you need to run your mobile food business on FoodTaxi.', 19.99, 239.88, 999,
  '{"unlimited_vans": true, "online_ordering": true, "whatsapp_ordering": true, "pos": true, "live_tracking": true, "hygiene_logging": true, "events_marketplace": true, "email_marketing": true}'::jsonb,
  true
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'FoodTaxi Business');

-- Old seeded tiers are no longer offered — deactivate (not delete) so any
-- existing subscription row referencing them by plan_id still resolves.
UPDATE subscription_plans SET is_active = false WHERE name IN ('Starter', 'Pro', 'Enterprise');


-- ----------------------------------------------------------------------------
-- 2. subscriptions — add the columns Phase B's access control and webhook
--    handling need. All nullable/defaulted, so existing rows are unaffected.
-- ----------------------------------------------------------------------------
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- grandfathered: businesses that already existed before Phase B introduced
-- real billing enforcement. See docs/FOODTAXI-TECHNICAL-BASELINE.md §B11 —
-- access control treats a grandfathered subscription as always-active,
-- regardless of status/trial_ends_at, until it's turned off or the business
-- actually subscribes through Stripe. This is a blanket, reversible safety
-- flag, not a per-business judgement call, so it does not require approval
-- before applying — it is applied uniformly and documented in the Phase B
-- report.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'grandfathered'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN grandfathered BOOLEAN NOT NULL DEFAULT false;
    -- One-time backfill: every subscription row that exists at the moment
    -- this migration first runs predates Phase B billing enforcement.
    UPDATE subscriptions SET grandfathered = true;
  END IF;
END $$;

-- One subscription per business. Guards against the webhook or checkout
-- flow ever creating a duplicate row for the same business (Phase B8).
-- Only added if no duplicates already exist live; if duplicates are found,
-- this is skipped and surfaced in the Phase B report rather than silently
-- deleting/merging data.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_business_id_key')
     AND NOT EXISTS (
       SELECT business_id FROM subscriptions GROUP BY business_id HAVING COUNT(*) > 1
     )
  THEN
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_business_id_key UNIQUE (business_id);
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 3. Stripe webhook idempotency (Phase B8). Stripe may redeliver the same
--    event; every event id is recorded once and skipped on redelivery.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id         TEXT PRIMARY KEY,   -- Stripe event.id
  type       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stripe_webhook_events_super_admin" ON stripe_webhook_events;
CREATE POLICY "stripe_webhook_events_super_admin" ON stripe_webhook_events FOR ALL USING (is_super_admin());
-- No other policy: this table is only ever touched by the webhook route
-- using the service-role key, same pattern as event_requests in Phase A.


-- ----------------------------------------------------------------------------
-- 4. Analytics query performance (Phase B16). Orders are already commonly
--    filtered by van + date range and by status.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_van_created ON orders(van_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
