-- ============================================================================
-- PHASE I — Customer Growth, Loyalty, CRM & Retention
-- ============================================================================
-- I1 CUSTOMER DATA AUDIT (performed before writing any of this — full
-- write-up in docs/FOODTAXI-TECHNICAL-BASELINE.md). Summary of findings:
--
--   - Authenticated `customers` accounts are RARE in practice — POS,
--     guest/online, and WhatsApp ordering (the dominant volume) all
--     create orders with orders.customer_id NULL and identity carried in
--     guest_name/guest_phone/guest_email instead (orders.customer_id was
--     made nullable in Phase C specifically for this). A CRM built only
--     around `customers` would miss almost every real order.
--   - `email_unsubscribes` is a PLATFORM-WIDE (not per-business) email
--     suppression list — email is the primary key. This is preserved
--     completely unchanged and remains the absolute floor: no business,
--     campaign, or preference setting in Phase I can ever re-enable
--     email to an address on this list.
--   - `whatsapp_customer_prefs` is NOT a consent/preference table despite
--     its name — it only tracks WhatsApp ORDERING conversation state
--     (last van picked, pending option list). There is no existing
--     WhatsApp marketing consent mechanism at all, so Phase I's WhatsApp
--     marketing opt-in defaults to false for every customer (I31) —
--     never inferred from having placed a WhatsApp order.
--   - `whatsapp_messages` logs inbound customer messages (from_phone,
--     created_at) — reused as-is to compute the WhatsApp 24-hour
--     session-window eligibility for campaign sending (see
--     lib/notify/whatsapp.ts); no new table needed for this.
--   - `reviews` exists but is completely unused (no reader or writer
--     anywhere in the app) and requires customer_id NOT NULL — unusable
--     for the guest-dominant order flow. Fixed here (customer_id made
--     nullable, guest_* columns added mirroring orders' own convention)
--     rather than replaced.
--   - `customer_favourite_vans` is keyed on authenticated customer_id
--     only — reused as-is (I26) for the accounts that have one; not
--     extended to guest identity, since a "favourite" is inherently a
--     returning-visit preference an anonymous guest has no way to
--     persist without an account or a stable device identifier anyway.
--   - `orders.discount_amount` (Phase B, menu deals) already exists and
--     is reused as the ONE place a discount is ever applied to an order
--     total — loyalty rewards, vouchers and promo codes all resolve to
--     this single field rather than each inventing its own discount
--     mechanism (I9's "do not build an excessively complex loyalty
--     engine" applied to the whole phase, not just loyalty).
--   - POS's "hand over" action (marks an order collected) was found to
--     update `orders` directly from the browser, bypassing
--     PATCH /api/orders/[id]/status entirely — the one place Phase C's
--     stock deduction is triggered. This is a genuine pre-existing gap
--     (POS orders were never deducting stock on hand-over), found during
--     this audit and fixed in application code alongside wiring up
--     loyalty earning through the same route (see
--     components/... pos/page.tsx) — not a schema change.
--   - CONCLUSION: `crm_customers` is a business-scoped IDENTITY +
--     PREFERENCE table only (I2) — never a stats cache. Order
--     count/spend/AOV/first-last-order/favourite items are always
--     computed live from `orders` at query time (lib/crm/profile.ts),
--     the exact same "compose at query time from source-of-truth"
--     principle Phase G's route analytics and Phase H's finance module
--     already established, so there is no second, driftable copy of
--     order history.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- I2/I3 — the business-scoped customer profile. identity_key is computed
-- in application code (lib/crm/identity.ts) as 'phone:<normalised>' when
-- a phone is known, else 'email:<lowercased>' when only an email is
-- known, else NULL for an unidentifiable walk-in (no row is ever created
-- for those — nothing to track). UNIQUE per business — the tenant
-- isolation boundary for "the same phone number ordering from two
-- different FoodTaxi businesses never merges into one CRM profile"
-- (I2/I81).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crm_customers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  identity_key          TEXT NOT NULL, -- 'phone:+447...' or 'email:x@y.com'
  customer_id           UUID REFERENCES customers(id) ON DELETE SET NULL, -- linked only on an exact phone/email match (I3) — never by name
  normalized_phone      TEXT,
  email                 TEXT,
  display_name          TEXT,
  marketing_email_opt_in    BOOLEAN NOT NULL DEFAULT false,
  marketing_whatsapp_opt_in BOOLEAN NOT NULL DEFAULT false,
  marketing_sms_opt_in      BOOLEAN NOT NULL DEFAULT false,
  loyalty_enrolled      BOOLEAN NOT NULL DEFAULT false,
  notes                 TEXT, -- internal, staff-only (I7) — never sent to AI as fact, see lib/ai/tools/crm.ts
  tags                  TEXT[] NOT NULL DEFAULT '{}', -- business-defined labels only (I8) — never auto-inferred sensitive attributes
  birthday_month_day    TEXT, -- optional 'MM-DD' ONLY if the customer voluntarily supplies it (I79) — never derived, never full DOB
  merged_into_id        UUID REFERENCES crm_customers(id) ON DELETE SET NULL, -- set when this profile was merged into another (I3) — the row is kept, not deleted, for audit
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, identity_key)
);
CREATE INDEX IF NOT EXISTS idx_crm_customers_business ON crm_customers(business_id);
CREATE INDEX IF NOT EXISTS idx_crm_customers_customer ON crm_customers(customer_id);

-- I20/I25/I53 — which discount code (promo or voucher) and/or referral
-- code, if any, an order used. Nullable, purely for reporting/attribution
-- (I53 — "if a unique promo code was redeemed, attribution can be
-- strong") — never a second place a discount amount is computed;
-- orders.discount_amount (Phase B) remains the one authoritative figure.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS referral_code_used TEXT;

-- I94 — CRM identity lookups filter orders by (van_id, guest_phone) /
-- (van_id, guest_email) constantly; these columns already existed
-- (Phase A/C) but had no dedicated index.
CREATE INDEX IF NOT EXISTS idx_orders_van_guest_phone ON orders(van_id, guest_phone);
CREATE INDEX IF NOT EXISTS idx_orders_van_guest_email ON orders(van_id, guest_email);

ALTER TABLE crm_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_customers_business" ON crm_customers;
CREATE POLICY "crm_customers_business" ON crm_customers
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());


-- ----------------------------------------------------------------------------
-- I9–I13 — loyalty. One ledger, both supported earning models (I9's
-- "points per spend" and "visit/order stamps") expressed identically as
-- a points_delta — a stamp is just an EARN of 1 point, reward_threshold
-- is the stamps_required count. No separate stamps engine.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_settings (
  business_id           UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  enabled               BOOLEAN NOT NULL DEFAULT false,
  programme_name        TEXT NOT NULL DEFAULT 'Loyalty Rewards',
  earning_method        TEXT NOT NULL DEFAULT 'points_per_spend' CHECK (earning_method IN ('points_per_spend', 'visit_stamps')),
  points_per_pound      NUMERIC(6,2) NOT NULL DEFAULT 1, -- points_per_spend mode
  min_qualifying_order  NUMERIC(10,2) NOT NULL DEFAULT 0,
  reward_threshold      NUMERIC(10,2) NOT NULL DEFAULT 100, -- points needed (or stamp count, in visit_stamps mode)
  reward_description    TEXT NOT NULL DEFAULT '£5 off your next order',
  reward_value          NUMERIC(10,2) NOT NULL DEFAULT 5,
  reward_value_type     TEXT NOT NULL DEFAULT 'fixed_amount' CHECK (reward_value_type IN ('fixed_amount', 'percentage')),
  expiry_days           INTEGER, -- NULL = points never expire
  eligible_channels     JSONB NOT NULL DEFAULT '["pos", "online", "guest", "whatsapp"]'::jsonb,
  eligible_van_ids      UUID[], -- NULL = all vans
  terms_text            TEXT,
  updated_by            UUID REFERENCES users(id),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE loyalty_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loyalty_settings_business" ON loyalty_settings;
CREATE POLICY "loyalty_settings_business" ON loyalty_settings
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  crm_customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  balance         NUMERIC(12,2) NOT NULL DEFAULT 0, -- cached; the ONLY writer is apply_loyalty_transaction() below
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (crm_customer_id)
);
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loyalty_accounts_business" ON loyalty_accounts;
CREATE POLICY "loyalty_accounts_business" ON loyalty_accounts
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

-- I11/I12 — the auditable transaction ledger. idempotency_key is what
-- makes earning safe under retry (I12): a UNIQUE constraint, not an
-- application-level check-then-act, backs "this exact order can only
-- ever EARN once" — e.g. 'order_collected:<order_id>'.
CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  loyalty_account_id UUID NOT NULL REFERENCES loyalty_accounts(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('EARN', 'REDEEM', 'ADJUST', 'EXPIRE', 'REFUND_REVERSAL', 'PROMOTIONAL_BONUS')),
  points_delta      NUMERIC(12,2) NOT NULL,
  balance_after     NUMERIC(12,2) NOT NULL,
  idempotency_key   TEXT, -- e.g. 'order_collected:<order_id>', 'redemption:<voucher_id>' — UNIQUE per business where present
  order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
  reason            TEXT,
  created_by        UUID REFERENCES users(id), -- NULL for a system-triggered EARN/REFUND_REVERSAL
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_ledger_idempotency ON loyalty_ledger(business_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_account ON loyalty_ledger(loyalty_account_id, created_at);
ALTER TABLE loyalty_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "loyalty_ledger_business" ON loyalty_ledger;
CREATE POLICY "loyalty_ledger_business" ON loyalty_ledger
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

-- I11/I12 — the ONLY way a loyalty balance ever changes, mirroring Phase
-- C's apply_stock_movement() exactly: row-locks the account, applies the
-- delta, writes the ledger row atomically. The idempotency_key's UNIQUE
-- constraint is what actually prevents a double-EARN under retry — this
-- function surfaces that as a clean "already applied" result rather than
-- letting the caller see a raw constraint-violation error.
CREATE OR REPLACE FUNCTION apply_loyalty_transaction(
  p_business_id UUID, p_loyalty_account_id UUID, p_type TEXT, p_points_delta NUMERIC,
  p_idempotency_key TEXT, p_order_id UUID, p_reason TEXT, p_created_by UUID
) RETURNS TABLE (applied BOOLEAN, new_balance NUMERIC) AS $$
DECLARE
  v_current NUMERIC;
  v_new NUMERIC;
BEGIN
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM loyalty_ledger WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key) THEN
      SELECT balance INTO v_current FROM loyalty_accounts WHERE id = p_loyalty_account_id;
      RETURN QUERY SELECT false, v_current;
      RETURN;
    END IF;
  END IF;

  SELECT balance INTO v_current FROM loyalty_accounts WHERE id = p_loyalty_account_id AND business_id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'loyalty_account_not_found';
  END IF;

  v_new := v_current + p_points_delta;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  UPDATE loyalty_accounts SET balance = v_new WHERE id = p_loyalty_account_id;
  INSERT INTO loyalty_ledger (business_id, loyalty_account_id, type, points_delta, balance_after, idempotency_key, order_id, reason, created_by)
  VALUES (p_business_id, p_loyalty_account_id, p_type, p_points_delta, v_new, p_idempotency_key, p_order_id, p_reason, p_created_by);

  RETURN QUERY SELECT true, v_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION apply_loyalty_transaction FROM PUBLIC, authenticated, anon;


-- ----------------------------------------------------------------------------
-- I20–I22 — promo codes. Discount calculation always happens server-side
-- (lib/crm/discounts.ts); this table only stores the rule.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS promo_codes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code                TEXT NOT NULL, -- stored uppercased; compared case-insensitively
  description         TEXT,
  discount_type       TEXT NOT NULL CHECK (discount_type IN ('fixed_amount', 'percentage')),
  discount_value      NUMERIC(10,2) NOT NULL,
  starts_at           TIMESTAMPTZ,
  ends_at             TIMESTAMPTZ,
  min_spend           NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_redemptions     INTEGER, -- NULL = unlimited
  per_customer_limit  INTEGER NOT NULL DEFAULT 1,
  eligible_van_ids    UUID[], -- NULL = all vans
  eligible_channels   JSONB,  -- NULL = all channels, else e.g. '["pos","online"]'
  new_customers_only  BOOLEAN NOT NULL DEFAULT false,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, code)
);
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "promo_codes_business" ON promo_codes;
CREATE POLICY "promo_codes_business" ON promo_codes
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

CREATE TABLE IF NOT EXISTS promo_redemptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  promo_code_id   UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  crm_customer_id UUID REFERENCES crm_customers(id) ON DELETE SET NULL,
  discount_amount NUMERIC(10,2) NOT NULL,
  redeemed_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (order_id) -- I22 — only one discount code per order, ever
);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_promo ON promo_redemptions(promo_code_id);
ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "promo_redemptions_business" ON promo_redemptions;
CREATE POLICY "promo_redemptions_business" ON promo_redemptions
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

-- I21 — race-condition-safe redemption: row-locks the promo, re-checks
-- max_redemptions and per_customer_limit inside the lock, then inserts
-- the redemption atomically. This is what "cannot be manipulated by two
-- simultaneous requests into over-redeeming a limited code" actually
-- means — an application-level check-then-insert would have a race
-- window this closes.
CREATE OR REPLACE FUNCTION redeem_promo_code(
  p_business_id UUID, p_promo_code_id UUID, p_order_id UUID, p_crm_customer_id UUID, p_discount_amount NUMERIC
) RETURNS TABLE (redeemed BOOLEAN, reason TEXT) AS $$
DECLARE
  v_promo RECORD;
  v_total_redemptions INTEGER;
  v_customer_redemptions INTEGER;
BEGIN
  SELECT * INTO v_promo FROM promo_codes WHERE id = p_promo_code_id AND business_id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'not_found'; RETURN; END IF;
  IF NOT v_promo.is_active THEN RETURN QUERY SELECT false, 'inactive'; RETURN; END IF;

  SELECT count(*) INTO v_total_redemptions FROM promo_redemptions WHERE promo_code_id = p_promo_code_id;
  IF v_promo.max_redemptions IS NOT NULL AND v_total_redemptions >= v_promo.max_redemptions THEN
    RETURN QUERY SELECT false, 'redemption_limit_reached'; RETURN;
  END IF;

  IF p_crm_customer_id IS NOT NULL AND v_promo.per_customer_limit IS NOT NULL THEN
    SELECT count(*) INTO v_customer_redemptions FROM promo_redemptions WHERE promo_code_id = p_promo_code_id AND crm_customer_id = p_crm_customer_id;
    IF v_customer_redemptions >= v_promo.per_customer_limit THEN
      RETURN QUERY SELECT false, 'per_customer_limit_reached'; RETURN;
    END IF;
  END IF;

  INSERT INTO promo_redemptions (business_id, promo_code_id, order_id, crm_customer_id, discount_amount)
  VALUES (p_business_id, p_promo_code_id, p_order_id, p_crm_customer_id, p_discount_amount);
  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION redeem_promo_code FROM PUBLIC, authenticated, anon;


-- ----------------------------------------------------------------------------
-- I23 — vouchers. A promotional/discount instrument only — explicitly
-- not a stored-value financial product (no cash-out, no balance carried
-- beyond its one discount value). Loyalty redemption (I14) and referral
-- rewards (I24) both mint a voucher here rather than each inventing a
-- separate discount mechanism — vouchers, promo codes and loyalty all
-- resolve through the exact same lib/crm/discounts.ts code path at
-- order creation.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vouchers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  code                TEXT NOT NULL, -- opaque, e.g. 'FTV-8K2N4Q'
  discount_type       TEXT NOT NULL CHECK (discount_type IN ('fixed_amount', 'percentage')),
  discount_value      NUMERIC(10,2) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REDEEMED', 'EXPIRED', 'VOID')),
  source              TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'loyalty_redemption', 'referral_reward')),
  intended_customer_id UUID REFERENCES crm_customers(id) ON DELETE SET NULL, -- NULL = anyone with the code
  issued_at           TIMESTAMPTZ DEFAULT now(),
  expires_at          TIMESTAMPTZ,
  redeemed_order_id   UUID REFERENCES orders(id) ON DELETE SET NULL,
  redeemed_at         TIMESTAMPTZ,
  created_by          UUID REFERENCES users(id),
  UNIQUE (business_id, code)
);
CREATE INDEX IF NOT EXISTS idx_vouchers_customer ON vouchers(intended_customer_id);
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vouchers_business" ON vouchers;
CREATE POLICY "vouchers_business" ON vouchers
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

-- I21 — the same atomic claim pattern: lock the voucher row, verify
-- ACTIVE + not expired + (no intended customer, or it matches), mark
-- REDEEMED in the same transaction. Prevents the exact same voucher
-- being applied to two orders under a race.
CREATE OR REPLACE FUNCTION redeem_voucher(
  p_business_id UUID, p_voucher_id UUID, p_order_id UUID, p_crm_customer_id UUID
) RETURNS TABLE (redeemed BOOLEAN, reason TEXT, discount_type TEXT, discount_value NUMERIC) AS $$
DECLARE
  v_voucher RECORD;
BEGIN
  SELECT * INTO v_voucher FROM vouchers WHERE id = p_voucher_id AND business_id = p_business_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT false, 'not_found', NULL::TEXT, NULL::NUMERIC; RETURN; END IF;
  IF v_voucher.status <> 'ACTIVE' THEN RETURN QUERY SELECT false, 'not_active', NULL::TEXT, NULL::NUMERIC; RETURN; END IF;
  IF v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at < now() THEN
    UPDATE vouchers SET status = 'EXPIRED' WHERE id = p_voucher_id;
    RETURN QUERY SELECT false, 'expired', NULL::TEXT, NULL::NUMERIC; RETURN;
  END IF;
  IF v_voucher.intended_customer_id IS NOT NULL AND v_voucher.intended_customer_id <> p_crm_customer_id THEN
    RETURN QUERY SELECT false, 'not_your_voucher', NULL::TEXT, NULL::NUMERIC; RETURN;
  END IF;

  UPDATE vouchers SET status = 'REDEEMED', redeemed_order_id = p_order_id, redeemed_at = now() WHERE id = p_voucher_id;
  RETURN QUERY SELECT true, NULL::TEXT, v_voucher.discount_type, v_voucher.discount_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
REVOKE ALL ON FUNCTION redeem_voucher FROM PUBLIC, authenticated, anon;


-- ----------------------------------------------------------------------------
-- I24/I25 — referrals. Idempotent and business-scoped: UNIQUE on
-- qualifying_order_id means a given order can only ever qualify one
-- referral, once.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_settings (
  business_id           UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  enabled               BOOLEAN NOT NULL DEFAULT false,
  referrer_reward_type  TEXT NOT NULL DEFAULT 'fixed_amount' CHECK (referrer_reward_type IN ('fixed_amount', 'percentage')),
  referrer_reward_value NUMERIC(10,2) NOT NULL DEFAULT 5,
  reward_new_customer   BOOLEAN NOT NULL DEFAULT true,
  referred_reward_type  TEXT NOT NULL DEFAULT 'fixed_amount' CHECK (referred_reward_type IN ('fixed_amount', 'percentage')),
  referred_reward_value NUMERIC(10,2) NOT NULL DEFAULT 5,
  updated_by            UUID REFERENCES users(id),
  updated_at            TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE referral_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referral_settings_business" ON referral_settings;
CREATE POLICY "referral_settings_business" ON referral_settings
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

CREATE TABLE IF NOT EXISTS referral_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  crm_customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, code),
  UNIQUE (business_id, crm_customer_id)
);
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referral_codes_business" ON referral_codes;
CREATE POLICY "referral_codes_business" ON referral_codes
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

CREATE TABLE IF NOT EXISTS referral_conversions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id              UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  referral_code_id         UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  referred_crm_customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  qualifying_order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  referrer_voucher_id      UUID REFERENCES vouchers(id) ON DELETE SET NULL,
  referred_voucher_id      UUID REFERENCES vouchers(id) ON DELETE SET NULL,
  status                   TEXT NOT NULL DEFAULT 'QUALIFIED' CHECK (status IN ('QUALIFIED', 'REWARDED', 'REVERSED')),
  created_at               TIMESTAMPTZ DEFAULT now(),
  UNIQUE (qualifying_order_id)
);
ALTER TABLE referral_conversions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referral_conversions_business" ON referral_conversions;
CREATE POLICY "referral_conversions_business" ON referral_conversions
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());


-- ----------------------------------------------------------------------------
-- I34–I38 — campaigns. Extends (does not replace) the existing ad-hoc
-- /api/marketing/send — that route is untouched and keeps working
-- exactly as it did. This is the new structured engine for
-- segmented/scheduled/multi-channel sends, with real idempotent
-- per-recipient delivery records (I38) instead of a fire-and-forget
-- loop.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaigns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  channel           TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  segment_definition JSONB NOT NULL, -- the deterministic segment filter used to build the audience (I29)
  subject           TEXT, -- email only
  message           TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PARTIALLY_FAILED', 'FAILED', 'CANCELLED')),
  scheduled_for     TIMESTAMPTZ,
  campaign_type     TEXT NOT NULL DEFAULT 'general' CHECK (campaign_type IN ('general', 'win_back', 'route_customer', 'closure_notice', 'offer')),
  estimated_recipients INTEGER,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  sent_at           TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_campaigns_business_status ON campaigns(business_id, status);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "campaigns_business" ON campaigns;
CREATE POLICY "campaigns_business" ON campaigns
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

-- I38 — one row reserved per recipient BEFORE sending (status 'QUEUED'),
-- UNIQUE(campaign_id, crm_customer_id) — a retried send loop, a cron
-- retry, or a duplicate confirm click all hit this constraint and skip
-- rather than send twice. Mirrors Phase D's automation_runs /
-- claimRun() pattern applied to per-recipient delivery instead of
-- per-business-per-day.
CREATE TABLE IF NOT EXISTS campaign_recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  crm_customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  contact         TEXT NOT NULL, -- the email/phone actually used, snapshotted at queue time
  status          TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'SENT', 'FAILED', 'SKIPPED_SUPPRESSED', 'SKIPPED_OUT_OF_WINDOW')),
  error           TEXT,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (campaign_id, crm_customer_id)
);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON campaign_recipients(campaign_id, status);
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "campaign_recipients_business" ON campaign_recipients;
CREATE POLICY "campaign_recipients_business" ON campaign_recipients
  FOR ALL USING (
    campaign_id IN (SELECT id FROM campaigns WHERE business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()))
    OR is_super_admin()
  );


-- ----------------------------------------------------------------------------
-- I45–I47 — feedback/reviews. `reviews` (Phase A, never previously wired
-- up) fixed to support guest identity and a private-vs-public
-- distinction rather than replaced.
-- ----------------------------------------------------------------------------
ALTER TABLE reviews ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS guest_phone TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS business_response TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS responded_by UUID REFERENCES users(id);
ALTER TABLE reviews ALTER COLUMN is_published SET DEFAULT false; -- I46 — never auto-published going forward
-- Backfills business_id from the van for any pre-existing rows (there are
-- none in practice — the table was never written to) so future RLS/queries
-- can use business_id directly rather than joining through vans.
UPDATE reviews SET business_id = vans.business_id FROM vans WHERE reviews.van_id = vans.id AND reviews.business_id IS NULL;

DROP POLICY IF EXISTS "reviews_business_manage" ON reviews;
CREATE POLICY "reviews_business_manage" ON reviews
  FOR ALL USING (van_id IN (SELECT my_van_ids()) OR is_super_admin());

-- I45 — has a feedback request already been sent for this order, so a
-- retried/duplicate automation run never asks twice.
CREATE TABLE IF NOT EXISTS feedback_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sent_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (order_id)
);
ALTER TABLE feedback_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feedback_requests_business" ON feedback_requests;
CREATE POLICY "feedback_requests_business" ON feedback_requests
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());


-- ----------------------------------------------------------------------------
-- I66 — audit: no new table. Every meaningful CRM action
-- (adjust_loyalty, promo created/changed, voucher issued, referral
-- reward, customer merge, campaign created/scheduled/sent) is written to
-- the existing audit_logs table via logAuditEvent(), the exact same
-- mechanism Phase C/D/H already use.
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- Indexes justified by the actual Phase I queries (I94).
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_promo_codes_business_code ON promo_codes(business_id, code);
CREATE INDEX IF NOT EXISTS idx_vouchers_business_code ON vouchers(business_id, code);
CREATE INDEX IF NOT EXISTS idx_reviews_business_published ON reviews(business_id, is_published);
