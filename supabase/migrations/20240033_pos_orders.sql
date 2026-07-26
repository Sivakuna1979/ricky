-- ============================================================================
-- POS (in-person till) ORDERS
-- Lets business staff ring up face-to-face sales into the SAME orders table
-- used by online/guest/WhatsApp checkout, so everything shows up together in
-- the existing dashboard, LiveOrdersBoard and reporting.
-- ============================================================================

-- customer_id is NOT NULL in the original schema, but the existing guest
-- checkout path (20240023_guest_orders.sql) already inserts orders without
-- one — the live database's constraint must have been relaxed out-of-band
-- at some point. Make that explicit and idempotent here so POS (and guest
-- checkout) reliably work regardless of the live DB's actual current state.
ALTER TABLE orders ALTER COLUMN customer_id DROP NOT NULL;

-- Track which channel created the order: online (authenticated checkout),
-- guest (public van page, no account), whatsapp (auto WhatsApp ordering),
-- pos (staff till). Previously there was no way to tell these apart other
-- than guessing from which columns were populated.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'online';

DO $$ BEGIN
  ALTER TABLE orders ADD CONSTRAINT orders_source_check
    CHECK (source IN ('online', 'guest', 'whatsapp', 'pos'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Staff creating a POS sale act on behalf of their business, not as the
-- customer — allow van owners/staff (already covered by my_van_ids()) to
-- insert orders directly, mirroring the guest-insert policy.
DROP POLICY IF EXISTS "orders_pos_insert" ON orders;
CREATE POLICY "orders_pos_insert" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (van_id IN (SELECT my_van_ids()));

DROP POLICY IF EXISTS "order_items_pos_insert" ON order_items;
CREATE POLICY "order_items_pos_insert" ON order_items
  FOR INSERT TO authenticated
  WITH CHECK (order_id IN (SELECT id FROM orders WHERE van_id IN (SELECT my_van_ids())));
