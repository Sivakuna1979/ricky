-- ============================================================================
-- PHASE C — Business operations: stock, suppliers, purchase orders, staff,
-- shifts/timesheets, vehicles, equipment.
-- ============================================================================
-- Additive and idempotent throughout. Nothing here drops a table, drops a
-- column, deletes a row, or renames anything. Reuses existing tables
-- wherever the schema already supports the need:
--   - `staff` (20240001_initial_schema.sql) — already business/van-scoped
--     with a role, is_active, invited_at/joined_at. Phase C activates it;
--     it does not replace it.
--   - `supplier_records` (20240001_initial_schema.sql) — already the
--     supplier directory shape C11 asks for. Extended, not duplicated.
--   - `audit_logs` (20240001_initial_schema.sql) — already the right shape
--     (Phase A recommendation). Phase C is the first code to write to it.
--   - `vans.registration_plate` — vehicle registration lives there already;
--     vehicle_details below is a 1:1 extension, not a duplicate identity.
-- ============================================================================


-- ============================================================================
-- 1. STAFF — activate the existing table for multi-van assignment
-- ============================================================================
-- staff currently has UNIQUE(business_id, user_id), which only allows ONE
-- row per person per business — i.e. only ever one van. C18 needs "assigned
-- to ALL VANS or SELECTED VANS" (plural), so one row per assigned van is
-- required, plus a single van_id = NULL row to mean "all vans". Nothing in
-- the app has ever written to `staff` (confirmed by the Phase A audit), so
-- relaxing this constraint is safe — there is no existing data it could
-- conflict with.
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_business_id_user_id_key;

-- 'business_admin' — C17's BUSINESS_ADMIN role. Only ever written to
-- staff.role, never to users.role (OWNER is businesses.owner_id, not a
-- staff row; SUPER_ADMIN stays platform-level and separate, per C17).
-- Enum additions are safe/additive in Postgres.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'business_admin';

-- my_van_ids() already UNIONs in active staff rows by van_id (see
-- 20240002_rls_policies.sql) — that's why every existing van-scoped table
-- (orders, menu_items, POS, tracking, etc.) will correctly start working
-- for staff the moment `staff` rows exist, with zero changes to those
-- tables. The one gap: a NULL van_id row was previously excluded by the
-- `van_id IS NOT NULL` filter, so it granted nothing — but NULL is meant to
-- mean "all vans" (C18's "Owner → All vans" / "Manager B → Van 15 + Van
-- 31" pattern). This redefinition is purely additive: every case the old
-- version granted, the new version still grants identically; it only adds
-- the NULL-van_id "all vans" case that was previously a no-op. Every other
-- policy built on my_van_ids() across the whole app becomes correct for
-- "all-vans" staff without being touched.
CREATE OR REPLACE FUNCTION my_van_ids()
RETURNS SETOF UUID AS $$
  SELECT id FROM vans WHERE business_id IN (SELECT my_business_ids())
  UNION
  SELECT v.id FROM vans v
  JOIN staff s ON s.business_id = v.business_id
  WHERE s.user_id = auth_user_id()
    AND s.is_active = true
    AND (s.van_id IS NULL OR s.van_id = v.id)
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Business-level (not van-scoped) visibility for active staff — used by
-- every new Phase C table below that is business-wide rather than
-- per-van (stock catalogue, suppliers, purchase orders, staff directory
-- itself, shifts, vehicles, equipment). This is deliberately coarse (any
-- active staff role sees these rows); which ACTIONS a given role may take
-- is enforced in the API layer by lib/permissions.ts, not by RLS — the
-- same "RLS = tenant boundary, API = permission boundary" split already
-- used for super-admin routes in Phase A. Documented as a known
-- simplification in docs/FOODTAXI-TECHNICAL-BASELINE.md.
CREATE OR REPLACE FUNCTION my_staff_business_ids()
RETURNS SETOF UUID AS $$
  SELECT DISTINCT business_id FROM staff WHERE user_id = auth_user_id() AND is_active = true
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ============================================================================
-- 2. SUPPLIERS — extend the existing supplier_records table (confirmed
--    unused by any code today), not a new "suppliers" table.
-- ============================================================================
ALTER TABLE supplier_records ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE supplier_records ADD COLUMN IF NOT EXISTS account_reference TEXT;
-- Distinct from `approved` (a hygiene/compliance flag) — this is simply
-- whether the business still uses this supplier.
ALTER TABLE supplier_records ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE supplier_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP POLICY IF EXISTS "supplier_records_staff" ON supplier_records;
CREATE POLICY "supplier_records_staff" ON supplier_records
  FOR ALL USING (business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());
-- (owner policy on supplier_records already exists from 20240001/20240002)


-- ============================================================================
-- 3. STOCK — catalogue, locations, per-location levels, movement ledger
-- ============================================================================
CREATE TABLE IF NOT EXISTS stock_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'other' CHECK (type IN ('warehouse', 'van', 'other')),
  van_id      UUID REFERENCES vans(id) ON DELETE CASCADE,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_locations_business ON stock_locations(business_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_locations_van ON stock_locations(van_id) WHERE van_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS stock_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  category         TEXT,
  sku              TEXT,
  barcode          TEXT,
  unit             TEXT NOT NULL DEFAULT 'each',
  pack_size        TEXT,
  minimum_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  reorder_quantity NUMERIC(12,2),
  cost_price       NUMERIC(10,2),
  supplier_id      UUID REFERENCES supplier_records(id) ON DELETE SET NULL,
  expiry_tracking  BOOLEAN NOT NULL DEFAULT false,
  active           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_items_business ON stock_items(business_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_barcode ON stock_items(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stock_items_supplier ON stock_items(supplier_id);

-- Current quantity is per-location (a transfer is meaningless otherwise) —
-- stock_items itself holds no quantity. Always written via
-- apply_stock_movement(), never updated directly, so every change is
-- auditable through stock_movements.
CREATE TABLE IF NOT EXISTS stock_levels (
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  location_id   UUID NOT NULL REFERENCES stock_locations(id) ON DELETE CASCADE,
  quantity      NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (stock_item_id, location_id)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  stock_item_id     UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  location_id       UUID NOT NULL REFERENCES stock_locations(id) ON DELETE CASCADE,
  movement_type     TEXT NOT NULL CHECK (movement_type IN ('PURCHASE','TRANSFER_IN','TRANSFER_OUT','SALE','WASTAGE','ADJUSTMENT','RETURN')),
  quantity          NUMERIC(12,2) NOT NULL, -- signed delta applied (negative = stock leaving)
  previous_quantity NUMERIC(12,2) NOT NULL,
  new_quantity      NUMERIC(12,2) NOT NULL,
  user_id           UUID REFERENCES users(id),
  reason            TEXT,
  reference_type    TEXT, -- 'order' | 'purchase_order' | 'stocktake' | 'wastage' | 'transfer' | NULL
  reference_id      UUID,
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_business_created ON stock_movements(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(stock_item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

-- The single place stock quantity ever changes (C1–C6, C8, C10, C13–C14).
-- Row-locks the stock_levels row so concurrent movements (e.g. two staff
-- recording wastage at once, or a retried webhook) can never lose an
-- update. p_delta is signed: negative removes stock, positive adds it.
CREATE OR REPLACE FUNCTION apply_stock_movement(
  p_business_id UUID, p_stock_item_id UUID, p_location_id UUID,
  p_movement_type TEXT, p_delta NUMERIC, p_user_id UUID,
  p_reason TEXT DEFAULT NULL, p_reference_type TEXT DEFAULT NULL, p_reference_id UUID DEFAULT NULL
) RETURNS NUMERIC AS $$
DECLARE
  v_previous NUMERIC;
  v_new NUMERIC;
BEGIN
  INSERT INTO stock_levels (stock_item_id, location_id, quantity)
  VALUES (p_stock_item_id, p_location_id, 0)
  ON CONFLICT (stock_item_id, location_id) DO NOTHING;

  SELECT quantity INTO v_previous FROM stock_levels
  WHERE stock_item_id = p_stock_item_id AND location_id = p_location_id
  FOR UPDATE;

  v_new := v_previous + p_delta;

  UPDATE stock_levels SET quantity = v_new, updated_at = now()
  WHERE stock_item_id = p_stock_item_id AND location_id = p_location_id;

  INSERT INTO stock_movements (
    business_id, stock_item_id, location_id, movement_type, quantity,
    previous_quantity, new_quantity, user_id, reason, reference_type, reference_id
  ) VALUES (
    p_business_id, p_stock_item_id, p_location_id, p_movement_type, p_delta,
    v_previous, v_new, p_user_id, p_reason, p_reference_type, p_reference_id
  );

  RETURN v_new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- This function moves stock without checking business ownership itself —
-- callers (the Node API routes) verify permission first, then call it with
-- the service-role client. It must never be callable directly by a
-- business's own session (anon/authenticated JWT), only by the server.
REVOKE ALL ON FUNCTION apply_stock_movement FROM PUBLIC;
REVOKE ALL ON FUNCTION apply_stock_movement FROM authenticated;
REVOKE ALL ON FUNCTION apply_stock_movement FROM anon;

ALTER TABLE stock_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_locations_business" ON stock_locations;
CREATE POLICY "stock_locations_business" ON stock_locations
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "stock_items_business" ON stock_items;
CREATE POLICY "stock_items_business" ON stock_items
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "stock_levels_business" ON stock_levels;
CREATE POLICY "stock_levels_business" ON stock_levels
  FOR SELECT USING (
    stock_item_id IN (SELECT id FROM stock_items WHERE business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()))
    OR is_super_admin()
  );
-- No owner/staff INSERT/UPDATE policy — stock_levels is only ever written
-- by apply_stock_movement() (SECURITY DEFINER, service-role only).

DROP POLICY IF EXISTS "stock_movements_business" ON stock_movements;
CREATE POLICY "stock_movements_business" ON stock_movements
  FOR SELECT USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());
-- No general INSERT policy — movements are only ever created inside
-- apply_stock_movement(), which is service-role only.


-- ============================================================================
-- 4. STOCKTAKE (C5)
-- ============================================================================
CREATE TABLE IF NOT EXISTS stocktakes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id  UUID NOT NULL REFERENCES stock_locations(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  started_by   UUID REFERENCES users(id),
  started_at   TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  notes        TEXT
);
CREATE INDEX IF NOT EXISTS idx_stocktakes_business ON stocktakes(business_id);

CREATE TABLE IF NOT EXISTS stocktake_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stocktake_id       UUID NOT NULL REFERENCES stocktakes(id) ON DELETE CASCADE,
  stock_item_id      UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  expected_quantity  NUMERIC(12,2) NOT NULL,
  counted_quantity   NUMERIC(12,2),
  created_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE (stocktake_id, stock_item_id)
);

ALTER TABLE stocktakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocktake_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stocktakes_business" ON stocktakes;
CREATE POLICY "stocktakes_business" ON stocktakes
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());
DROP POLICY IF EXISTS "stocktake_items_business" ON stocktake_items;
CREATE POLICY "stocktake_items_business" ON stocktake_items
  FOR ALL USING (
    stocktake_id IN (SELECT id FROM stocktakes WHERE business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()))
    OR is_super_admin()
  );


-- ============================================================================
-- 5. MENU ↔ STOCK RECIPE LINK (C7) + AUTOMATIC DEDUCTION SUPPORT (C8)
-- ============================================================================
CREATE TABLE IF NOT EXISTS menu_stock_components (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id      UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  stock_item_id     UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  quantity_per_item NUMERIC(12,3) NOT NULL,
  unit              TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (menu_item_id, stock_item_id)
);
CREATE INDEX IF NOT EXISTS idx_menu_stock_components_menu_item ON menu_stock_components(menu_item_id);

ALTER TABLE menu_stock_components ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "menu_stock_components_business" ON menu_stock_components;
CREATE POLICY "menu_stock_components_business" ON menu_stock_components
  FOR ALL USING (
    menu_item_id IN (SELECT id FROM menu_items WHERE van_id IN (SELECT my_van_ids()))
    OR is_super_admin()
  );

-- Idempotency guards for automatic deduction (C8): set once when an order's
-- stock is deducted, cleared logic lives in application code (lib/stockDeduction.ts)
-- — this column is the compare-and-set guard against duplicate deduction from
-- retries/duplicate webhook delivery/offline POS re-sync/double status
-- transitions. stock_restored_at is the equivalent guard for cancellations.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_deducted_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_restored_at TIMESTAMPTZ;


-- ============================================================================
-- 6. WASTAGE (C10)
-- ============================================================================
CREATE TABLE IF NOT EXISTS wastage_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  location_id  UUID NOT NULL REFERENCES stock_locations(id) ON DELETE CASCADE,
  quantity     NUMERIC(12,2) NOT NULL,
  cost         NUMERIC(10,2),
  reason       TEXT NOT NULL,
  notes        TEXT,
  recorded_by  UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wastage_business_created ON wastage_records(business_id, created_at);

ALTER TABLE wastage_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wastage_records_business" ON wastage_records;
CREATE POLICY "wastage_records_business" ON wastage_records
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());


-- ============================================================================
-- 7. SUPPLIER PRODUCTS + PURCHASE ORDERS (C12–C14)
-- ============================================================================
CREATE TABLE IF NOT EXISTS supplier_products (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  supplier_id           UUID NOT NULL REFERENCES supplier_records(id) ON DELETE CASCADE,
  stock_item_id         UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  supplier_product_code TEXT,
  pack_size             TEXT,
  latest_cost           NUMERIC(10,2),
  preferred             BOOLEAN NOT NULL DEFAULT false,
  last_purchased_at     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE (supplier_id, stock_item_id)
);
CREATE INDEX IF NOT EXISTS idx_supplier_products_business ON supplier_products(business_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_stock_item ON supplier_products(stock_item_id);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  supplier_id   UUID NOT NULL REFERENCES supplier_records(id),
  status        TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ORDERED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED')),
  ordered_by    UUID REFERENCES users(id),
  expected_date DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_business_status ON purchase_orders(business_id, status);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id  UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  stock_item_id      UUID NOT NULL REFERENCES stock_items(id),
  quantity_ordered   NUMERIC(12,2) NOT NULL,
  quantity_received  NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_cost          NUMERIC(10,2),
  created_at         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id);

ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_products_business" ON supplier_products;
CREATE POLICY "supplier_products_business" ON supplier_products
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "purchase_orders_business" ON purchase_orders;
CREATE POLICY "purchase_orders_business" ON purchase_orders
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "purchase_order_items_business" ON purchase_order_items;
CREATE POLICY "purchase_order_items_business" ON purchase_order_items
  FOR ALL USING (
    purchase_order_id IN (SELECT id FROM purchase_orders WHERE business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()))
    OR is_super_admin()
  );


-- ============================================================================
-- 8. SHIFTS + TIME ENTRIES (C19–C21)
-- ============================================================================
CREATE TABLE IF NOT EXISTS shifts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id    UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  van_id      UUID REFERENCES vans(id),
  shift_date  DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  notes       TEXT,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shifts_business_date ON shifts(business_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_staff ON shifts(staff_id);

CREATE TABLE IF NOT EXISTS time_entries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id            UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  van_id              UUID REFERENCES vans(id),
  clock_in_at         TIMESTAMPTZ NOT NULL,
  clock_out_at        TIMESTAMPTZ,
  is_manual_adjustment BOOLEAN NOT NULL DEFAULT false,
  adjustment_reason   TEXT,
  adjusted_by         UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_time_entries_business ON time_entries(business_id, clock_in_at);
CREATE INDEX IF NOT EXISTS idx_time_entries_staff ON time_entries(staff_id, clock_in_at);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shifts_business" ON shifts;
CREATE POLICY "shifts_business" ON shifts
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

DROP POLICY IF EXISTS "time_entries_business" ON time_entries;
CREATE POLICY "time_entries_business" ON time_entries
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());


-- ============================================================================
-- 9. VEHICLES (C22, C24, C26) — extends `vans`, does not duplicate it
-- ============================================================================
CREATE TABLE IF NOT EXISTS vehicle_details (
  van_id              UUID PRIMARY KEY REFERENCES vans(id) ON DELETE CASCADE,
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  make                TEXT,
  model               TEXT,
  year                INTEGER,
  fuel_type           TEXT,
  vin                 TEXT,
  mot_expiry          DATE,
  insurance_expiry    DATE,
  tax_expiry          DATE, -- UK road tax
  service_due_date    DATE,
  service_due_mileage INTEGER,
  mileage             INTEGER,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_details_business ON vehicle_details(business_id);

-- Metadata only for now (type + expiry date + optional external link),
-- matching hygiene_documents' existing file_url-as-text convention — there
-- is no established Supabase Storage bucket/upload architecture anywhere
-- in FoodTaxi yet to safely extend (confirmed: zero `.storage.from(` calls
-- in apps/web). Building a new private-bucket upload flow from scratch is
-- exactly the kind of unreviewed security surface Phase C should not
-- introduce casually — see docs/FOODTAXI-TECHNICAL-BASELINE.md "Known
-- issues" for the reminder-engine functionality this still fully supports
-- (expiry dates don't need a file), and what real upload needs later.
CREATE TABLE IF NOT EXISTS vehicle_documents (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  van_id         UUID NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  document_type  TEXT NOT NULL,
  file_url       TEXT,
  expiry_date    DATE,
  notes          TEXT,
  uploaded_by    UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_documents_van ON vehicle_documents(van_id);

CREATE TABLE IF NOT EXISTS vehicle_maintenance (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  van_id              UUID NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  maintenance_date    DATE NOT NULL,
  mileage             INTEGER,
  maintenance_type    TEXT NOT NULL DEFAULT 'OTHER',
  description         TEXT,
  supplier_id         UUID REFERENCES supplier_records(id) ON DELETE SET NULL,
  cost                NUMERIC(10,2),
  next_service_date   DATE,
  next_service_mileage INTEGER,
  document_id         UUID REFERENCES vehicle_documents(id) ON DELETE SET NULL,
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vehicle_maintenance_van ON vehicle_maintenance(van_id, maintenance_date);

ALTER TABLE vehicle_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehicle_details_business" ON vehicle_details;
CREATE POLICY "vehicle_details_business" ON vehicle_details
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());
DROP POLICY IF EXISTS "vehicle_documents_business" ON vehicle_documents;
CREATE POLICY "vehicle_documents_business" ON vehicle_documents
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());
DROP POLICY IF EXISTS "vehicle_maintenance_business" ON vehicle_maintenance;
CREATE POLICY "vehicle_maintenance_business" ON vehicle_maintenance
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());


-- ============================================================================
-- 10. EQUIPMENT (C25)
-- ============================================================================
CREATE TABLE IF NOT EXISTS equipment (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  van_id           UUID REFERENCES vans(id) ON DELETE SET NULL,
  location_id      UUID REFERENCES stock_locations(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  type             TEXT,
  serial_number    TEXT,
  installed_date   DATE,
  service_date     DATE,
  next_service_date DATE,
  warranty_expiry  DATE,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','needs_service','out_of_service','retired')),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_equipment_business ON equipment(business_id);

CREATE TABLE IF NOT EXISTS equipment_maintenance (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  equipment_id      UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  maintenance_date  DATE NOT NULL,
  description       TEXT,
  cost              NUMERIC(10,2),
  supplier_id       UUID REFERENCES supplier_records(id) ON DELETE SET NULL,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_equipment ON equipment_maintenance(equipment_id);

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_maintenance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "equipment_business" ON equipment;
CREATE POLICY "equipment_business" ON equipment
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());
DROP POLICY IF EXISTS "equipment_maintenance_business" ON equipment_maintenance;
CREATE POLICY "equipment_maintenance_business" ON equipment_maintenance
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());


-- ============================================================================
-- 11. Indexes for existing tables Phase C queries heavily (C39)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_staff_business ON staff(business_id);
CREATE INDEX IF NOT EXISTS idx_staff_user ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
