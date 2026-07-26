-- ============================================================================
-- DAILY-RESET ORDER NUMBERS
-- order_number was 'FT-YYYYMMDD-NNNN' but NNNN came from one global,
-- never-resetting sequence (order_number_seq) — so day two's first order
-- was #0002, not #0001, and the counter just climbed forever across days
-- instead of restarting each morning like a business actually wants.
--
-- Also: guest checkout and the WhatsApp auto-order webhook never used this
-- trigger at all — they generated their own ad-hoc "FT" + timestamp number
-- client-side, bypassing it entirely. Those call sites have been updated to
-- leave order_number unset so every channel (online, guest, WhatsApp, POS)
-- now shares this same daily-reset numbering.
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_number_counters (
  order_date DATE PRIMARY KEY,
  counter    INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  today  DATE;
  next_n INTEGER;
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    -- Local (business) day, not UTC, so the reset happens at UK midnight.
    today := (NOW() AT TIME ZONE 'Europe/London')::DATE;

    INSERT INTO order_number_counters (order_date, counter)
    VALUES (today, 1)
    ON CONFLICT (order_date) DO UPDATE SET counter = order_number_counters.counter + 1
    RETURNING counter INTO next_n;

    NEW.order_number = 'FT-' || TO_CHAR(today, 'YYYYMMDD') || '-' || LPAD(next_n::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;
