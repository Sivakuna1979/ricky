-- ============================================================================
-- GUEST ORDERS
-- Customers order from the public van page without an account. The orders
-- table previously had no INSERT policy for the anon role, so every guest
-- checkout was rejected by RLS and no order was saved.
-- ============================================================================

-- Guest/checkout columns (no-ops when they already exist)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_location TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_time TEXT;

-- Guests may create new pending orders only — they cannot read, edit or
-- delete anything. Owners keep their existing read/update policies.
DROP POLICY IF EXISTS "orders_guest_insert" ON orders;
CREATE POLICY "orders_guest_insert" ON orders
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending');

DROP POLICY IF EXISTS "order_items_guest_insert" ON order_items;
CREATE POLICY "order_items_guest_insert" ON order_items
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
