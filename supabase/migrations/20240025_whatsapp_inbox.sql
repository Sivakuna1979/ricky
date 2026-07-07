-- ============================================================================
-- WHATSAPP INBOX
-- Deduplication + audit log for messages received via the WhatsApp Cloud API
-- webhook (Meta retries deliveries, so each message id must be processed once).
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id          TEXT PRIMARY KEY,          -- Meta message id (wamid...)
  from_phone  TEXT,
  body        TEXT,
  order_id    UUID REFERENCES orders(id),
  outcome     TEXT,                      -- ordered | no_items | error
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_messages_admin" ON whatsapp_messages;
CREATE POLICY "whatsapp_messages_admin" ON whatsapp_messages
  FOR ALL USING (is_super_admin());
