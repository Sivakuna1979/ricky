-- ============================================================================
-- PHASE H — Finance, Expenses, Reconciliation & Accounting Hub
-- ============================================================================
-- H1 FINANCIAL DATA AUDIT (performed before writing any of this — see
-- docs/FOODTAXI-TECHNICAL-BASELINE.md Phase H section for the full
-- write-up). Summary of what already exists and is treated as
-- authoritative — NOT duplicated by anything below:
--
--   - orders.total / orders.subtotal / orders.vat_amount / orders.status /
--     orders.payment_method / orders.source / orders.service_date — the
--     one source of sales revenue (Phase B's rule: sum(total) excluding
--     status='cancelled'). Phase H's finance module reads this directly;
--     it never re-derives or re-stores a sales total anywhere.
--   - payments (Stripe online payments) and stripe_webhook_events —
--     already the record of online card capture. Not touched.
--   - subscriptions / subscription_plans — the £19.99/month FoodTaxi
--     platform subscription. Structurally already has no revenue
--     amount duplicated into it from food sales, and Phase H's finance
--     queries never read from it as a source of business revenue.
--   - event_applications.foodtaxi_fee (£29.99) — the FoodTaxi event
--     booking fee, paid to the platform, not the business's food
--     revenue. Phase H never includes it in a business's sales figures.
--   - purchase_orders / purchase_order_items — Phase C's stock ordering
--     and goods-received workflow (quantity_ordered/quantity_received/
--     unit_cost). Reused AS-IS for PO↔invoice matching (H14/H15) rather
--     than duplicated. It has no invoice number, VAT split, or payment
--     tracking of its own — that gap is exactly what supplier_invoices
--     below fills, linked to a PO, not replacing it.
--   - stock_items.cost_price — the business's latest known unit cost.
--     No per-movement historical cost exists anywhere (stock_movements
--     has no unit_cost column). COGS in Phase H therefore uses "latest
--     confirmed cost" (H24's explicitly-permitted simpler option, not
--     weighted average, since no cost history exists to average over) —
--     documented as a known limitation: editing a stock item's cost
--     price going forward changes the cost basis used for past-period
--     COGS the NEXT time a report is generated, since no historical
--     snapshot is taken per sale. A true point-in-time snapshot would
--     require adding a cost column to stock_movements — judged out of
--     scope for this phase (see docs "Not built").
--   - wastage_records.cost, vehicle_maintenance.cost,
--     equipment_maintenance.cost — already-authoritative cost records.
--     Phase H's Vehicle/Equipment Costs views read these tables
--     directly; they are NOT re-entered as `expenses` rows (that would
--     be exactly the "second financial truth" H1 warns against). An
--     `expenses` row with category 'vehicle'/'repairs'/'equipment' is
--     for costs NOT already captured by those tables (e.g. a parking
--     fine), not a duplicate of them.
--   - No file/document storage infrastructure exists anywhere in the
--     app (vehicle_documents/hygiene_documents are metadata-only,
--     optional external file_url text fields, same convention followed
--     here for finance_documents — see docs "Not built" for why no new
--     upload/storage system was introduced in this phase).
--   - CONCLUSION: no ledger abstraction table is created (H7 — "only if
--     necessary"). Each money-moving fact (a sale, a refund, an
--     expense, a supplier invoice, a cash count) keeps its own single
--     source-of-truth table; Phase H's reporting composes these at
--     query time in lib/finance/*, the same way Phase G's route
--     analytics compose orders + route_session_stops without a
--     separate materialised table.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Currency (H80) — GBP primary, column added so the architecture is not
-- hard-coded to £ at the schema level even though every current UI
-- surface still displays £ directly.
-- ----------------------------------------------------------------------------
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'GBP';

-- ----------------------------------------------------------------------------
-- H58/H59 — ACCOUNTANT role. Additive enum value, same safe pattern
-- already used for 'business_admin' in Phase C. Finance-scoped
-- permissions only (lib/permissions.ts) — no automatic operational-admin
-- rights.
-- ----------------------------------------------------------------------------
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'accountant';


-- ----------------------------------------------------------------------------
-- H8–H11 — expenses. Only ever CONFIRMED or VOID — an in-review draft
-- from document extraction lives in finance_documents.extracted_data
-- until a person confirms it, at which point (and only then) an expenses
-- row is created (H11's "extract → review → confirm → expense").
-- Categories are plain labels only (H9) — they never imply a VAT
-- treatment; net/vat/gross are entered/reviewed explicitly per expense.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  expense_date   DATE NOT NULL,
  supplier_id    UUID REFERENCES supplier_records(id) ON DELETE SET NULL,
  van_id         UUID REFERENCES vans(id) ON DELETE SET NULL, -- optional allocation; NULL = business-wide (H72)
  description    TEXT NOT NULL,
  category       TEXT NOT NULL CHECK (category IN (
                   'food_stock','drinks','packaging','fuel','vehicle','repairs','equipment',
                   'insurance','rent_storage','phone_internet','marketing','staff','cleaning',
                   'professional_fees','other'
                 )),
  net_amount     NUMERIC(12,2) NOT NULL,
  vat_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  gross_amount   NUMERIC(12,2) NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'GBP',
  payment_method TEXT NOT NULL DEFAULT 'other' CHECK (payment_method IN ('cash','card','bank_transfer','other')),
  reference      TEXT,
  document_id    UUID, -- FK added below once finance_documents exists
  source         TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','document_extraction','other')),
  status         TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED','VOID')),
  voided_at      TIMESTAMPTZ,
  voided_by      UUID REFERENCES users(id),
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_business_date ON expenses(business_id, expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_van ON expenses(van_id);

-- ----------------------------------------------------------------------------
-- H11 — extraction staging. A receipt/invoice image is sent to Claude
-- vision (the same pattern as app/api/menu/scan) and the STRUCTURED
-- RESULT is stored here as `extracted_data`; the source image itself is
-- never persisted (see the "no file storage" note above). Unconfirmed
-- extraction is never authoritative (H66) — only once a person reviews
-- and confirms does a real `expenses`/`supplier_invoices` row exist.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finance_documents (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id               UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  uploaded_by               UUID REFERENCES users(id),
  source_kind               TEXT NOT NULL DEFAULT 'receipt' CHECK (source_kind IN ('receipt','invoice','other')),
  file_url                  TEXT, -- optional external link only (same convention as vehicle_documents) — no file is stored by FoodTaxi itself
  extracted_data            JSONB,
  extraction_status         TEXT NOT NULL DEFAULT 'PENDING' CHECK (extraction_status IN ('PENDING','EXTRACTED','CONFIRMED','FAILED')),
  linked_expense_id         UUID REFERENCES expenses(id) ON DELETE SET NULL,
  linked_supplier_invoice_id UUID, -- FK added below once supplier_invoices exists
  created_at                TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finance_documents_business ON finance_documents(business_id, created_at);

ALTER TABLE expenses ADD CONSTRAINT fk_expenses_document FOREIGN KEY (document_id) REFERENCES finance_documents(id) ON DELETE SET NULL;


-- ----------------------------------------------------------------------------
-- H12–H15 — supplier invoices. Header-level only (net/VAT/gross totals,
-- not per-line items) — matched against a linked purchase_order's own
-- (already line-level) quantity_ordered/quantity_received/unit_cost for
-- H14's PO-vs-goods-received-vs-invoice review. amount_paid/outstanding
-- are computed at query time from supplier_invoice_payments, never
-- stored, so there is exactly one place a payment total can drift from.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  supplier_id       UUID NOT NULL REFERENCES supplier_records(id),
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
  document_id       UUID REFERENCES finance_documents(id) ON DELETE SET NULL,
  invoice_number    TEXT,
  invoice_date      DATE NOT NULL,
  due_date          DATE,
  net_amount        NUMERIC(12,2) NOT NULL,
  vat_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  gross_amount      NUMERIC(12,2) NOT NULL,
  currency          TEXT NOT NULL DEFAULT 'GBP',
  status            TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','REVIEW','UNPAID','PARTIALLY_PAID','PAID','VOID')),
  notes             TEXT,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
-- Duplicate-safe numbering (H15) — same (supplier, invoice_number) can't
-- be entered twice for a business. NULL invoice_number (not every
-- receipt has one) is never treated as a duplicate by this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_invoices_unique_number
  ON supplier_invoices(business_id, supplier_id, invoice_number) WHERE invoice_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_business_status ON supplier_invoices(business_id, status);

ALTER TABLE finance_documents ADD CONSTRAINT fk_finance_documents_invoice FOREIGN KEY (linked_supplier_invoice_id) REFERENCES supplier_invoices(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS supplier_invoice_payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_invoice_id UUID NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_at             DATE NOT NULL,
  payment_method      TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('cash','card','bank_transfer','other')),
  reference           TEXT,
  recorded_by         UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_payments_invoice ON supplier_invoice_payments(supplier_invoice_id);


-- ----------------------------------------------------------------------------
-- H22/H23 — refunds. A separate factual record, never a mutation of
-- orders.status (the order_status enum/UI is untouched) — revenue
-- queries subtract matching refunds explicitly instead. status stays a
-- single 'RECORDED' value for now (H23 — no real provider refund is
-- ever issued without an approved integration, which does not exist).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refunds (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reason       TEXT NOT NULL,
  method       TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','card','other')),
  status       TEXT NOT NULL DEFAULT 'RECORDED' CHECK (status IN ('RECORDED')),
  refunded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by  UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refunds_business_date ON refunds(business_id, refunded_at);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);


-- ----------------------------------------------------------------------------
-- H16–H18 — cash reconciliation. Daily, per van (matching route_sessions'
-- own granularity — route_session_id is an optional link, not required).
-- cash_sales/cash_refunds/recorded_cash_expenses are SNAPSHOTS taken at
-- count time, not live-recomputed later, so a correction made afterwards
-- to an order/expense never silently rewrites a historical count's
-- numbers (H56 — corrections are their own auditable action instead).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_reconciliations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  van_id                  UUID NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  service_date            DATE NOT NULL,
  route_session_id        UUID REFERENCES route_sessions(id) ON DELETE SET NULL,
  opening_float           NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_sales_recorded     NUMERIC(12,2) NOT NULL,
  cash_refunds_recorded   NUMERIC(12,2) NOT NULL DEFAULT 0,
  recorded_cash_expenses  NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_cash           NUMERIC(12,2) NOT NULL,
  actual_cash             NUMERIC(12,2) NOT NULL,
  variance                NUMERIC(12,2) NOT NULL,
  denomination_breakdown  JSONB, -- optional { "50":0,"20":0,...,"0.01":0 } UK count, or omitted for a direct total
  variance_reason         TEXT,
  recorded_by             UUID REFERENCES users(id),
  created_at              TIMESTAMPTZ DEFAULT now(),
  UNIQUE (van_id, service_date)
);
CREATE INDEX IF NOT EXISTS idx_cash_reconciliations_business_date ON cash_reconciliations(business_id, service_date);


-- ----------------------------------------------------------------------------
-- H19–H21 — card reconciliation. Provider-neutral: `provider` is free
-- text (SumUp/Square/Zettle/Stripe/Other), external_terminal_total is a
-- manual entry — there is no live provider integration, so this is never
-- labelled a "settlement" or "bank receipt" anywhere in the app.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS card_reconciliations (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id                 UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  van_id                      UUID NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  service_date                DATE NOT NULL,
  foodtaxi_card_recorded_total NUMERIC(12,2) NOT NULL,
  provider                    TEXT,
  external_terminal_total     NUMERIC(12,2),
  variance                    NUMERIC(12,2),
  notes                       TEXT,
  recorded_by                 UUID REFERENCES users(id),
  created_at                  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (van_id, service_date)
);
CREATE INDEX IF NOT EXISTS idx_card_reconciliations_business_date ON card_reconciliations(business_id, service_date);


-- ----------------------------------------------------------------------------
-- H32–H37 — VAT. Registration is never assumed (is_registered defaults
-- false); default_rate is the one place a percentage is configured
-- (H32's "centralise... never scatter percentages") — nothing else in
-- Phase H hard-codes a VAT percentage.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vat_settings (
  business_id    UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  is_registered  BOOLEAN NOT NULL DEFAULT false,
  vat_number     TEXT,
  effective_from DATE,
  default_rate   NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  updated_by     UUID REFERENCES users(id),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- H57 — optional period locking, reused for both a general finance
-- period and a VAT review period (same shape either way: a date range
-- that becomes immutable once locked). Unlocking is itself an
-- authorised, audited action (logAuditEvent, application layer) — never
-- a silent flip.
CREATE TABLE IF NOT EXISTS finance_periods (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end   DATE NOT NULL,
  locked       BOOLEAN NOT NULL DEFAULT false,
  locked_by    UUID REFERENCES users(id),
  locked_at    TIMESTAMPTZ,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, period_start, period_end)
);


-- ----------------------------------------------------------------------------
-- H41–H45 — customer invoices (catering/events), kept entirely separate
-- from the FoodTaxi £29.99 platform event-booking fee. Business-scoped,
-- duplicate-safe numbering with an optional prefix.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_invoices (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_application_id UUID REFERENCES event_applications(id) ON DELETE SET NULL,
  invoice_prefix      TEXT,
  invoice_number      TEXT NOT NULL,
  customer_name       TEXT NOT NULL,
  customer_email      TEXT,
  invoice_date        DATE NOT NULL,
  due_date            DATE,
  net_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  vat_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  gross_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SENT','PAID','OVERDUE','VOID')),
  notes                TEXT,
  created_by           UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS customer_invoice_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_invoice_id UUID NOT NULL REFERENCES customer_invoices(id) ON DELETE CASCADE,
  description         TEXT NOT NULL,
  quantity            NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price          NUMERIC(12,2) NOT NULL,
  vat_rate            NUMERIC(5,2),
  line_total          NUMERIC(12,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customer_invoice_items_invoice ON customer_invoice_items(customer_invoice_id);

CREATE TABLE IF NOT EXISTS customer_invoice_payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_invoice_id UUID NOT NULL REFERENCES customer_invoices(id) ON DELETE CASCADE,
  amount              NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_at             DATE NOT NULL,
  method              TEXT NOT NULL DEFAULT 'bank_transfer' CHECK (method IN ('cash','card','bank_transfer','other')),
  reference           TEXT,
  recorded_by         UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_invoice_payments_invoice ON customer_invoice_payments(customer_invoice_id);


-- ----------------------------------------------------------------------------
-- H46–H53 — provider-neutral accounting mapping ARCHITECTURE only (no
-- real Xero/QuickBooks connection exists or is called anywhere). A
-- business can label an expense category with an external chart-of-
-- accounts code/name; the export route surfaces it as an extra column
-- when set, nothing more. Editing a mapping is explicitly not tax advice
-- (H53) — it's a label, exactly like expense categories themselves.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finance_account_mappings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  account_code  TEXT,
  account_name  TEXT,
  updated_by    UUID REFERENCES users(id),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, category)
);
ALTER TABLE finance_account_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "finance_account_mappings_business" ON finance_account_mappings;
CREATE POLICY "finance_account_mappings_business" ON finance_account_mappings
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());


-- ----------------------------------------------------------------------------
-- H54 — finance review queue. A generic queue (item_type + a pointer to
-- the record) rather than one table per review reason.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS finance_review_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  item_type    TEXT NOT NULL CHECK (item_type IN (
                 'extraction_review','unknown_vat','duplicate_expense','invoice_po_mismatch',
                 'cash_variance','card_variance','missing_supplier','uncategorised_expense'
               )),
  related_table TEXT,
  related_id    UUID,
  status        TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','DISMISSED')),
  detail        JSONB,
  created_at    TIMESTAMPTZ DEFAULT now(),
  resolved_by   UUID REFERENCES users(id),
  resolved_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_finance_review_items_business_status ON finance_review_items(business_id, status);


-- ----------------------------------------------------------------------------
-- RLS — every new table follows the exact tenant-isolation pattern used
-- since Phase C. Role/permission enforcement (who may create/void/pay)
-- happens in the API layer (lib/permissions.ts), not here — same split
-- documented for every prior phase.
-- ----------------------------------------------------------------------------
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_review_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_business" ON expenses;
CREATE POLICY "expenses_business" ON expenses FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "finance_documents_business" ON finance_documents;
CREATE POLICY "finance_documents_business" ON finance_documents FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "supplier_invoices_business" ON supplier_invoices;
CREATE POLICY "supplier_invoices_business" ON supplier_invoices FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "supplier_invoice_payments_business" ON supplier_invoice_payments;
CREATE POLICY "supplier_invoice_payments_business" ON supplier_invoice_payments FOR ALL USING (
  supplier_invoice_id IN (SELECT id FROM supplier_invoices WHERE business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()))
  OR is_super_admin()
);

DROP POLICY IF EXISTS "refunds_business" ON refunds;
CREATE POLICY "refunds_business" ON refunds FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "cash_reconciliations_business" ON cash_reconciliations;
CREATE POLICY "cash_reconciliations_business" ON cash_reconciliations FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "card_reconciliations_business" ON card_reconciliations;
CREATE POLICY "card_reconciliations_business" ON card_reconciliations FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "vat_settings_business" ON vat_settings;
CREATE POLICY "vat_settings_business" ON vat_settings FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "finance_periods_business" ON finance_periods;
CREATE POLICY "finance_periods_business" ON finance_periods FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "customer_invoices_business" ON customer_invoices;
CREATE POLICY "customer_invoices_business" ON customer_invoices FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "customer_invoice_items_business" ON customer_invoice_items;
CREATE POLICY "customer_invoice_items_business" ON customer_invoice_items FOR ALL USING (
  customer_invoice_id IN (SELECT id FROM customer_invoices WHERE business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()))
  OR is_super_admin()
);

DROP POLICY IF EXISTS "customer_invoice_payments_business" ON customer_invoice_payments;
CREATE POLICY "customer_invoice_payments_business" ON customer_invoice_payments FOR ALL USING (
  customer_invoice_id IN (SELECT id FROM customer_invoices WHERE business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()))
  OR is_super_admin()
);

DROP POLICY IF EXISTS "finance_review_items_business" ON finance_review_items;
CREATE POLICY "finance_review_items_business" ON finance_review_items FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());
