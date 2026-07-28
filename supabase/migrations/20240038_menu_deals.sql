-- ============================================================================
-- MENU DEALS
-- "Mix and match" multi-buy pricing, e.g. "any 3 sauces for £1" — pick a set
-- of eligible menu items, a quantity threshold, and a flat bundle price.
-- ============================================================================

CREATE TABLE IF NOT EXISTS menu_deals (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  van_id     UUID NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  quantity   INTEGER NOT NULL CHECK (quantity >= 2),
  deal_price DECIMAL(10,2) NOT NULL CHECK (deal_price >= 0),
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_deal_items (
  deal_id      UUID NOT NULL REFERENCES menu_deals(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  PRIMARY KEY (deal_id, menu_item_id)
);

ALTER TABLE menu_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_deal_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "menu_deals_owner" ON menu_deals;
CREATE POLICY "menu_deals_owner" ON menu_deals
  FOR ALL USING (van_id IN (SELECT my_van_ids())) WITH CHECK (van_id IN (SELECT my_van_ids()));

DROP POLICY IF EXISTS "menu_deals_public_read" ON menu_deals;
CREATE POLICY "menu_deals_public_read" ON menu_deals
  FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "menu_deal_items_owner" ON menu_deal_items;
CREATE POLICY "menu_deal_items_owner" ON menu_deal_items
  FOR ALL USING (deal_id IN (SELECT id FROM menu_deals WHERE van_id IN (SELECT my_van_ids())))
  WITH CHECK (deal_id IN (SELECT id FROM menu_deals WHERE van_id IN (SELECT my_van_ids())));

DROP POLICY IF EXISTS "menu_deal_items_public_read" ON menu_deal_items;
CREATE POLICY "menu_deal_items_public_read" ON menu_deal_items
  FOR SELECT USING (true);

-- So a receipt/order can show "Deal savings: -£0.50" rather than silently
-- charging less than the sum of its line items.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;
