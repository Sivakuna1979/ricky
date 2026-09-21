-- ============================================================================
-- PHASE L — Payments, Accounting Integrations & External Connectivity.
--
-- L1 AUDIT FINDINGS (full write-up in docs/FOODTAXI-TECHNICAL-BASELINE.md):
--   - Real money movement today is exactly two live Stripe Checkout flows,
--     both FoodTaxi's own account (never a customer's food payment): the
--     £19.99/mo + 3-day-trial subscription (app/api/subscriptions/checkout)
--     and the £29.99 one-off event-booking fee (app/api/events/pay). Both
--     stay completely untouched by this migration — no column on
--     `subscriptions`, `subscription_plans`, `event_applications`, or
--     `event_requests` is altered.
--   - The original `payments` table (stripe_payment_intent_id / charge_id)
--     and the Connect-style `app/api/payments/create-intent` route are
--     confirmed dead/unreferenced code — no UI calls it, `stripe_account_id`
--     has never been set. Both are left exactly as-is (not deleted, not
--     activated) — this migration builds a NEW, provider-neutral schema
--     alongside them rather than repurposing that dead path.
--   - POS `card_at_van` and guest/online `card_online` are payment-method
--     LABELS ONLY today — no card is ever processed. `refunds.status` is
--     schema-constrained to the single value 'RECORDED' (100% manual).
--     `card_reconciliations.provider`/`external_terminal_total` are
--     free-text/manual entry. None of this changes here — the new
--     provider-neutral tables below are additive, read by the new
--     reconciliation/Integration Centre layer, never a replacement for the
--     existing manual entry paths (which keep working exactly as today).
--   - No OAuth or external-accounting integration exists anywhere in
--     apps/web — this is a genuinely blank slate for Xero/QuickBooks.
--
-- CRITICAL: nothing in this migration activates live customer card
-- processing. `payment_provider_connections` can be created here, but no
-- code path in this phase sets one to CONNECTED against a real provider —
-- that is explicitly gated behind the user's separate, explicit approval
-- of a specific provider (see the Phase L provider decision report).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- L4/L25 — payment-provider connections (SumUp/Stripe Terminal/Square/
-- Zettle/Dojo/Other). One row per business per provider. Holds ONLY
-- non-secret status/identity fields — real OAuth/API credentials live in
-- `payment_provider_secrets`, a separate table with no RLS policy granting
-- any authenticated/staff role SELECT access (service-role/admin-client
-- only). This split means a bug in a normal API route can never leak a
-- token: the token literally isn't in any table that route could query.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_provider_connections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL CHECK (provider IN ('STRIPE_TERMINAL','SUMUP','SQUARE','ZETTLE','DOJO','OTHER')),
  status                TEXT NOT NULL DEFAULT 'DISCONNECTED' CHECK (status IN ('DISCONNECTED','CONNECTED','ACTION_REQUIRED','ERROR')),
  external_account_id   TEXT,
  external_account_name TEXT,
  scopes                TEXT[],
  last_checked_at       TIMESTAMPTZ,
  last_error            TEXT,
  connected_by          UUID REFERENCES users(id),
  connected_at          TIMESTAMPTZ,
  disconnected_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_payment_provider_connections_business ON payment_provider_connections(business_id);
ALTER TABLE payment_provider_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_provider_connections_business" ON payment_provider_connections;
CREATE POLICY "payment_provider_connections_business" ON payment_provider_connections
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

-- Secrets: RLS enabled, deliberately ZERO policies for any client role —
-- only a service-role (admin) client bypasses RLS and can read/write this
-- table. Never selected by any API route that returns JSON to the browser.
CREATE TABLE IF NOT EXISTS payment_provider_secrets (
  connection_id      UUID PRIMARY KEY REFERENCES payment_provider_connections(id) ON DELETE CASCADE,
  access_token       TEXT,
  refresh_token      TEXT,
  token_expires_at   TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE payment_provider_secrets ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- L30 — accounting connections (Xero/QuickBooks). Same non-secret/secret
-- split as payments above.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounting_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL CHECK (provider IN ('XERO','QUICKBOOKS')),
  status            TEXT NOT NULL DEFAULT 'DISCONNECTED' CHECK (status IN ('DISCONNECTED','CONNECTED','ACTION_REQUIRED','ERROR')),
  external_org_id   TEXT,
  external_org_name TEXT,
  scopes            TEXT[],
  last_sync_at      TIMESTAMPTZ,
  last_checked_at   TIMESTAMPTZ,
  last_error        TEXT,
  connected_by      UUID REFERENCES users(id),
  connected_at      TIMESTAMPTZ,
  disconnected_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_accounting_connections_business ON accounting_connections(business_id);
ALTER TABLE accounting_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accounting_connections_business" ON accounting_connections;
CREATE POLICY "accounting_connections_business" ON accounting_connections
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

CREATE TABLE IF NOT EXISTS accounting_secrets (
  connection_id      UUID PRIMARY KEY REFERENCES accounting_connections(id) ON DELETE CASCADE,
  access_token       TEXT,
  refresh_token      TEXT,
  token_expires_at   TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE accounting_secrets ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- L27 — short-lived OAuth state (CSRF) + PKCE code_verifier for BOTH
-- payment-provider and accounting OAuth flows. One row per authorize
-- attempt, consumed (used_at set) at callback time — a state cannot be
-- replayed. 10-minute expiry is enforced in application code, not here.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oauth_states (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider_kind  TEXT NOT NULL CHECK (provider_kind IN ('PAYMENT','ACCOUNTING')),
  provider       TEXT NOT NULL,
  state          TEXT NOT NULL UNIQUE,
  code_verifier  TEXT,
  redirect_uri   TEXT NOT NULL,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL,
  used_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
-- No client-role policy — this table is only ever touched by the server's
-- own admin client during an OAuth redirect round-trip.

-- ----------------------------------------------------------------------------
-- L11 — provider-neutral payment terminal metadata. No device secrets
-- (pairing codes/API keys for a specific reader live with the provider,
-- never copied here) — just enough to show "which terminal is assigned to
-- which van" in the Integration Centre and POS.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_terminals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  van_id             UUID REFERENCES vans(id) ON DELETE SET NULL,
  connection_id      UUID REFERENCES payment_provider_connections(id) ON DELETE CASCADE,
  provider           TEXT NOT NULL CHECK (provider IN ('STRIPE_TERMINAL','SUMUP','SQUARE','ZETTLE','DOJO','OTHER')),
  provider_device_id TEXT,
  label              TEXT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'UNASSIGNED' CHECK (status IN ('ACTIVE','OFFLINE','UNASSIGNED','ERROR')),
  last_seen_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_terminals_business ON payment_terminals(business_id);
ALTER TABLE payment_terminals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_terminals_business" ON payment_terminals;
CREATE POLICY "payment_terminals_business" ON payment_terminals
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

-- ----------------------------------------------------------------------------
-- L7/L8 — provider-neutral payment transactions. Idempotent by construction:
-- UNIQUE(provider, provider_transaction_id) means a retried webhook or a
-- retried "create transaction" call can never create a second row — a
-- second insert attempt hits the unique violation and the caller updates
-- the existing row instead (see lib/payments/transactions.ts).
-- `order_id` is nullable because a transaction can exist before an order is
-- fully confirmed (e.g. AUTHORISED but not yet SUCCEEDED).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provider_transactions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id              UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  van_id                   UUID REFERENCES vans(id) ON DELETE SET NULL,
  order_id                 UUID REFERENCES orders(id) ON DELETE SET NULL,
  connection_id            UUID REFERENCES payment_provider_connections(id) ON DELETE SET NULL,
  terminal_id              UUID REFERENCES payment_terminals(id) ON DELETE SET NULL,
  provider                 TEXT NOT NULL CHECK (provider IN ('STRIPE_TERMINAL','SUMUP','SQUARE','ZETTLE','DOJO','OTHER')),
  provider_transaction_id  TEXT NOT NULL,
  status                   TEXT NOT NULL CHECK (status IN ('CREATED','PENDING','AUTHORISED','SUCCEEDED','FAILED','CANCELLED','PARTIALLY_REFUNDED','REFUNDED')),
  payment_method_type      TEXT NOT NULL CHECK (payment_method_type IN ('CASH','CARD_RECORDED','PROVIDER_VERIFIED_CARD','ONLINE_PROVIDER','OTHER')),
  amount                   NUMERIC(12,2) NOT NULL,
  currency                 TEXT NOT NULL DEFAULT 'GBP',
  status_detail            JSONB,
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now(),
  UNIQUE (provider, provider_transaction_id)
);
CREATE INDEX IF NOT EXISTS idx_provider_transactions_business ON provider_transactions(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_transactions_order ON provider_transactions(order_id);
ALTER TABLE provider_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "provider_transactions_business" ON provider_transactions;
CREATE POLICY "provider_transactions_business" ON provider_transactions
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

-- ----------------------------------------------------------------------------
-- L18 — provider-side refunds. Distinct from the existing `refunds` table
-- (which stays exactly as-is — the manual/cash bookkeeping record every
-- business already relies on). `refund_id` links the two when a provider
-- refund corresponds to a manual refund entry, so Finance Hub can show one
-- reconciled picture without merging the tables. Idempotent the same way as
-- transactions: UNIQUE(provider, provider_refund_id).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provider_refunds (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider_transaction_id UUID NOT NULL REFERENCES provider_transactions(id) ON DELETE CASCADE,
  refund_id               UUID REFERENCES refunds(id) ON DELETE SET NULL,
  provider                TEXT NOT NULL CHECK (provider IN ('STRIPE_TERMINAL','SUMUP','SQUARE','ZETTLE','DOJO','OTHER')),
  provider_refund_id      TEXT,
  amount                  NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reason                  TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SUCCEEDED','FAILED','CANCELLED')),
  requested_by            UUID REFERENCES users(id),
  confirmed_by            UUID REFERENCES users(id),
  idempotency_key         TEXT NOT NULL UNIQUE,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_refunds_provider_ref ON provider_refunds(provider, provider_refund_id) WHERE provider_refund_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_provider_refunds_business ON provider_refunds(business_id);
ALTER TABLE provider_refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "provider_refunds_business" ON provider_refunds;
CREATE POLICY "provider_refunds_business" ON provider_refunds
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

-- ----------------------------------------------------------------------------
-- L9 — shared webhook idempotency log for every external provider (payment
-- AND accounting). Mirrors the exact pattern already proven in production
-- by `stripe_webhook_events` (20240049) — insert event_id first, a unique
-- violation on redelivery means "already handled, no-op". Only minimal
-- metadata is stored (never the full raw payload) to avoid retaining
-- sensitive data unnecessarily (L44).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provider_webhook_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_kind TEXT NOT NULL CHECK (provider_kind IN ('PAYMENT','ACCOUNTING')),
  provider      TEXT NOT NULL,
  event_id      TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  business_id   UUID REFERENCES businesses(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','PROCESSED','FAILED','IGNORED')),
  error_detail  TEXT,
  received_at   TIMESTAMPTZ DEFAULT now(),
  processed_at  TIMESTAMPTZ,
  UNIQUE (provider, event_id)
);
CREATE INDEX IF NOT EXISTS idx_provider_webhook_events_business ON provider_webhook_events(business_id, received_at DESC);
ALTER TABLE provider_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "provider_webhook_events_business" ON provider_webhook_events;
CREATE POLICY "provider_webhook_events_business" ON provider_webhook_events
  FOR SELECT USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

-- ----------------------------------------------------------------------------
-- L35 — accounting account/tax mappings. Deliberately a NEW table, not an
-- extension of Phase H's `finance_account_mappings` — that table is a
-- generic, provider-agnostic CSV-export label (no tax code, no external
-- account id, not tied to any real connection) and stays exactly as-is for
-- that purpose. This table is specifically for a REAL, connection-bound
-- Xero/QuickBooks mapping used by the sync engine. `tax_code` is never
-- auto-guessed — NULL until a human sets it, and the sync engine refuses to
-- push a category with no mapping (L36/L37, see lib/accounting/mapping.ts).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounting_account_mappings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL CHECK (provider IN ('XERO','QUICKBOOKS')),
  category              TEXT NOT NULL CHECK (category IN (
                           'sales','food_stock','packaging','fuel','vehicle',
                           'repairs','equipment','marketing','professional_fees','other'
                         )),
  external_account_id   TEXT,
  external_account_name TEXT,
  tax_code              TEXT,
  updated_by            UUID REFERENCES users(id),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, provider, category)
);
ALTER TABLE accounting_account_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accounting_account_mappings_business" ON accounting_account_mappings;
CREATE POLICY "accounting_account_mappings_business" ON accounting_account_mappings
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

-- ----------------------------------------------------------------------------
-- L38 — background accounting sync queue. `idempotency_key` is what makes
-- re-queueing the same underlying fact (e.g. "van A's sales summary for
-- 2026-09-20") safe — UNIQUE constraint means a duplicate enqueue just
-- fails the insert rather than creating a second job (caller upserts on
-- conflict instead, see lib/accounting/syncEngine.ts). `attempts`/
-- `next_retry_at` back the exponential-backoff + dead-letter behaviour;
-- a job stuck at FAILED past a retry ceiling is surfaced to NEEDS_REVIEW
-- rather than retried forever.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accounting_sync_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  connection_id    UUID NOT NULL REFERENCES accounting_connections(id) ON DELETE CASCADE,
  provider         TEXT NOT NULL CHECK (provider IN ('XERO','QUICKBOOKS')),
  job_type         TEXT NOT NULL CHECK (job_type IN ('SALES_SUMMARY','EXPENSE','SUPPLIER_INVOICE','CUSTOMER_INVOICE','REFUND')),
  source_ref       TEXT NOT NULL,
  external_id      TEXT,
  status           TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('NOT_SYNCED','QUEUED','SYNCING','SYNCED','FAILED','NEEDS_REVIEW')),
  attempts         INT NOT NULL DEFAULT 0,
  last_error       TEXT,
  next_retry_at    TIMESTAMPTZ DEFAULT now(),
  idempotency_key  TEXT NOT NULL UNIQUE,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_accounting_sync_jobs_pending ON accounting_sync_jobs(status, next_retry_at) WHERE status IN ('QUEUED','FAILED');
CREATE INDEX IF NOT EXISTS idx_accounting_sync_jobs_business ON accounting_sync_jobs(business_id, created_at DESC);
ALTER TABLE accounting_sync_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accounting_sync_jobs_business" ON accounting_sync_jobs;
CREATE POLICY "accounting_sync_jobs_business" ON accounting_sync_jobs
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

-- ----------------------------------------------------------------------------
-- L45 — the review queue every reconciliation/sync discrepancy surfaces
-- into. Generic (category + JSONB reference), same shape as Phase H's own
-- `finance_review_items` — deliberately not merged with it, since this
-- queue is specifically about EXTERNAL provider/accounting mismatches
-- (never guessed/auto-resolved), while finance_review_items is Phase H's
-- internal-document-extraction queue.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reconciliation_review_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category     TEXT NOT NULL CHECK (category IN (
                 'UNMATCHED_PROVIDER_TXN','MISSING_CONFIRMATION','AMOUNT_MISMATCH',
                 'DUPLICATE_CANDIDATE','PAYOUT_DISCREPANCY','SYNC_CONFLICT'
               )),
  reference    JSONB NOT NULL,
  detail       TEXT,
  status       TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','DISMISSED')),
  created_at   TIMESTAMPTZ DEFAULT now(),
  resolved_at  TIMESTAMPTZ,
  resolved_by  UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_reconciliation_review_items_business ON reconciliation_review_items(business_id, status);
ALTER TABLE reconciliation_review_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reconciliation_review_items_business" ON reconciliation_review_items;
CREATE POLICY "reconciliation_review_items_business" ON reconciliation_review_items
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());
