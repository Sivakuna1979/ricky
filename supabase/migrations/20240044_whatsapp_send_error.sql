-- ============================================================================
-- The webhook was silently swallowing failures when replying to a customer
-- on WhatsApp — the order would be created fine (outcome: 'ordered') but if
-- the actual reply message failed to send (bad/expired token, wrong phone
-- number id, outside the 24h customer-service window, etc.) nobody could
-- tell, since the error was caught and discarded. This column captures it.
-- ============================================================================

ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS send_error TEXT;
