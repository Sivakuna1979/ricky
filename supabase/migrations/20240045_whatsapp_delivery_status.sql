-- ============================================================================
-- A 200 response from Meta's /messages endpoint only means our reply was
-- ACCEPTED for delivery, not that it actually reached the customer's phone.
-- The real outcome (sent/delivered/read/failed) arrives later as a separate
-- async "statuses" webhook event, keyed by the outbound message id (wamid) —
-- which we weren't capturing or listening for at all. That's how a reply
-- could be silently accepted by Meta and never actually arrive, with our
-- own logs showing no error whatsoever.
-- ============================================================================

ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS reply_wamid TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS delivery_status TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS delivery_error TEXT;

CREATE INDEX IF NOT EXISTS whatsapp_messages_reply_wamid_idx ON whatsapp_messages (reply_wamid);
