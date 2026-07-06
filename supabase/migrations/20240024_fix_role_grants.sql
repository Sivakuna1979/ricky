-- ============================================================================
-- FIX MISSING ROLE GRANTS (root cause of every "permission denied for table")
-- This database was missing the standard Supabase grants for anon,
-- authenticated and even service_role on public tables. RLS policies still
-- enforce row-level access — these grants just let roles reach the tables.
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Ensure future tables automatically get the same grants.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
