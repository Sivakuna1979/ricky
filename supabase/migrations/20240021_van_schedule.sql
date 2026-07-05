-- ============================================================================
-- VAN SCHEDULE
-- Weekly recurring pickup schedule for each van (day + location + times).
-- Owners/admins/staff manage their own van's schedule; public can read it.
-- ============================================================================

CREATE TABLE IF NOT EXISTS van_schedule (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  van_id        UUID NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  day_of_week   INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Mon .. 6=Sun
  location_name TEXT NOT NULL,
  arrival_time  TEXT NOT NULL DEFAULT '16:30',
  departure_time TEXT NOT NULL DEFAULT '20:30',
  notes         TEXT DEFAULT '',
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_van_schedule_van_id ON van_schedule(van_id);
CREATE INDEX IF NOT EXISTS idx_van_schedule_day ON van_schedule(van_id, day_of_week, sort_order);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
ALTER TABLE van_schedule ENABLE ROW LEVEL SECURITY;

-- Remove any ad-hoc/unsafe policies that may have been created manually.
DROP POLICY IF EXISTS "public_all"  ON van_schedule;
DROP POLICY IF EXISTS "auth_all"    ON van_schedule;
DROP POLICY IF EXISTS "public_read" ON van_schedule;
DROP POLICY IF EXISTS "van_schedule_super_admin" ON van_schedule;
DROP POLICY IF EXISTS "van_schedule_owner_all"   ON van_schedule;
DROP POLICY IF EXISTS "van_schedule_public_read" ON van_schedule;

-- Super admins can do anything.
CREATE POLICY "van_schedule_super_admin" ON van_schedule
  FOR ALL USING (is_super_admin());

-- Owners (and staff assigned to the van) may insert/update/delete only their
-- own van's schedule. my_van_ids() = vans owned by my businesses + assigned vans.
CREATE POLICY "van_schedule_owner_all" ON van_schedule
  FOR ALL
  USING (van_id IN (SELECT my_van_ids()))
  WITH CHECK (van_id IN (SELECT my_van_ids()));

-- Anyone (including anonymous customers) can read the published schedule.
CREATE POLICY "van_schedule_public_read" ON van_schedule
  FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- Grants — required in addition to RLS. A manually created table has no role
-- grants, which is why inserts previously failed with "permission denied for
-- table van_schedule" even with policies in place.
-- ----------------------------------------------------------------------------
GRANT SELECT ON van_schedule TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON van_schedule TO authenticated;
