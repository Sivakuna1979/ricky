-- ============================================================================
-- UK EVENT MARKETPLACE UPGRADES
-- Region tagging for UK-wide discovery + £29.99 flat booking fee default.
-- ============================================================================

ALTER TABLE event_requests ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE event_requests ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'customer'; -- customer | foodtaxi
ALTER TABLE event_requests ALTER COLUMN foodtaxi_fee SET DEFAULT 29.99;

CREATE INDEX IF NOT EXISTS idx_event_requests_region ON event_requests(region);
CREATE INDEX IF NOT EXISTS idx_event_requests_market ON event_requests(marketplace_visible, event_date);
