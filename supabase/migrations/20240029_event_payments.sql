-- ============================================================================
-- EVENT BOOKING FEE PAYMENTS (£29.99 flat via Stripe Checkout)
-- ============================================================================

ALTER TABLE event_applications ADD COLUMN IF NOT EXISTS fee NUMERIC(8,2);
ALTER TABLE event_applications ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
ALTER TABLE event_applications ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
