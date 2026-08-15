-- ============================================================================
-- Lets a customer who ordered online check in when they're actually leaving
-- to come collect — since a fresh order only takes 5-7 minutes to cook, this
-- is the "start now" signal instead of the kitchen guessing from order time
-- alone (which is misleading for anything ordered ahead of time).
-- ============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
