-- ============================================================================
-- WHATSAPP CHANNELS (multi-tenant)
-- Each business can connect its own WhatsApp Cloud API number. The shared
-- webhook routes incoming messages to the right van by phone_number_id and
-- replies using that business's own access token.
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_channels (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  van_id           UUID NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  phone_number_id  TEXT UNIQUE NOT NULL,   -- Meta Cloud API phone number id
  access_token     TEXT NOT NULL,          -- that business's Meta token
  display_number   TEXT DEFAULT '',        -- human-readable, e.g. +44 7961 929557
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_channels_super_admin" ON whatsapp_channels;
CREATE POLICY "whatsapp_channels_super_admin" ON whatsapp_channels
  FOR ALL USING (is_super_admin());

DROP POLICY IF EXISTS "whatsapp_channels_owner" ON whatsapp_channels;
CREATE POLICY "whatsapp_channels_owner" ON whatsapp_channels
  FOR ALL
  USING (business_id IN (SELECT my_business_ids()))
  WITH CHECK (business_id IN (SELECT my_business_ids()));
