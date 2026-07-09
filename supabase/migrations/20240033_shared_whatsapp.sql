-- ============================================================================
-- SHARED FOODTAXI WHATSAPP NUMBER
-- One platform number serves every business: the AI works out which van the
-- customer wants and remembers their choice for next time.
-- ============================================================================

ALTER TABLE whatsapp_channels ALTER COLUMN business_id DROP NOT NULL;
ALTER TABLE whatsapp_channels ALTER COLUMN van_id DROP NOT NULL;
ALTER TABLE whatsapp_channels ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false;

-- Which van each customer phone number last ordered from (+ pending pick list)
CREATE TABLE IF NOT EXISTS whatsapp_customer_prefs (
  phone      TEXT PRIMARY KEY,
  van_id     UUID REFERENCES vans(id) ON DELETE SET NULL,
  options    JSONB,             -- numbered van choices we last offered
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE whatsapp_customer_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "whatsapp_customer_prefs_admin" ON whatsapp_customer_prefs;
CREATE POLICY "whatsapp_customer_prefs_admin" ON whatsapp_customer_prefs
  FOR ALL USING (is_super_admin());
