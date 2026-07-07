-- ============================================================================
-- WHATSAPP SETUP REQUESTS
-- Businesses request WhatsApp ordering; FoodTaxi staff set it up privately.
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  note         TEXT DEFAULT '',
  status       TEXT DEFAULT 'pending',   -- pending | done | dismissed
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_requests_super_admin" ON whatsapp_requests;
CREATE POLICY "whatsapp_requests_super_admin" ON whatsapp_requests
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "whatsapp_requests_owner" ON whatsapp_requests;
CREATE POLICY "whatsapp_requests_owner" ON whatsapp_requests
  FOR ALL
  USING (business_id IN (SELECT my_business_ids()))
  WITH CHECK (business_id IN (SELECT my_business_ids()));
