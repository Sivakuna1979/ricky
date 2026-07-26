-- ============================================================================
-- RECEIPTS
-- Adds the columns needed to show/email an accurate receipt after a sale:
-- an optional customer email (mirrors the existing guest_name/guest_phone
-- pattern) and how much cash was tendered, so change given can be shown
-- on the receipt itself, not just live at the till.
-- ============================================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_tendered DECIMAL(10,2);
