-- ============================================================================
-- PHASE N — production hardening. One narrow, additive, non-destructive fix
-- found during the RLS coverage audit: order_number_counters (added in
-- 20240034) never had RLS enabled. Every write to it goes through
-- generate_order_number(), a SECURITY DEFINER trigger function — no
-- application code touches this table directly — so leaving RLS off meant
-- Supabase's PostgREST layer exposed it to the anon/authenticated roles'
-- default grants with no row-level restriction at all: anyone holding the
-- public anon key (present in every browser bundle, by design) could read
-- or write order_number_counters directly over the REST API, bypassing the
-- trigger and potentially corrupting/duplicating daily order numbers.
--
-- This migration only enables RLS with zero policies, which is a pure
-- restriction (default-deny for anon/authenticated; the SECURITY DEFINER
-- function and the service-role admin client are unaffected since neither
-- goes through RLS) — it cannot break any existing read/write path.
-- ============================================================================

ALTER TABLE order_number_counters ENABLE ROW LEVEL SECURITY;
