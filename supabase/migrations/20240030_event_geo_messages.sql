-- ============================================================================
-- EVENT GEO SEARCH + IN-APP MESSAGING
-- ============================================================================

-- Coordinates for postcode/distance search (geocoded via postcodes.io)
ALTER TABLE event_requests ADD COLUMN IF NOT EXISTS postcode TEXT;
ALTER TABLE event_requests ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE event_requests ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- All event communication stays inside FoodTaxi
CREATE TABLE IF NOT EXISTS event_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES event_applications(id) ON DELETE CASCADE,
  sender         TEXT NOT NULL CHECK (sender IN ('van', 'foodtaxi')),
  body           TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_messages_app ON event_messages(application_id, created_at);

ALTER TABLE event_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_messages_admin" ON event_messages;
CREATE POLICY "event_messages_admin" ON event_messages
  FOR ALL USING (is_super_admin());
