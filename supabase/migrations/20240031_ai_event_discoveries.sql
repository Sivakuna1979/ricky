-- Background AI event discovery runs (start -> poll pattern)
CREATE TABLE IF NOT EXISTS ai_event_discoveries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area       TEXT,
  status     TEXT DEFAULT 'running',   -- running | done | error
  events     JSONB,
  error      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE ai_event_discoveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_event_discoveries_admin" ON ai_event_discoveries;
CREATE POLICY "ai_event_discoveries_admin" ON ai_event_discoveries
  FOR ALL USING (is_super_admin());
