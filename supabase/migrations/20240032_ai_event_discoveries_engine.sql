-- Track which discovery engine actually produced the results (google | fable)
-- so the UI can show that instead of always claiming "Fable".
ALTER TABLE ai_event_discoveries ADD COLUMN IF NOT EXISTS engine TEXT;
