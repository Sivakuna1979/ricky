-- Log of interest emails sent to event organisers (avoids double-sending)
CREATE TABLE IF NOT EXISTS event_outreach (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name      TEXT,
  event_date      TEXT,
  organiser_email TEXT,
  status          TEXT,           -- sent | failed | draft
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE event_outreach ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_outreach_admin" ON event_outreach;
CREATE POLICY "event_outreach_admin" ON event_outreach
  FOR ALL USING (is_super_admin());
