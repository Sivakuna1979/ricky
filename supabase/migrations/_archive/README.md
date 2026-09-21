# Archived pre-renumbering migration files

Found during Phase O's migration-reconstruction audit (O7/O8).

`migration2_part_b.sql` and `migration3_functions_triggers.sql` are
pre-renumbering legacy copies of what became `20240002_rls_policies.sql`
and `20240003_functions_triggers.sql` respectively — confirmed by `diff`
(content is functionally identical, only comment formatting differs for
the functions file; the RLS file's policy names substantially overlap).

**Why they were moved out of `supabase/migrations/`**: Supabase applies
migration files in lexicographic filename order. Every `2024xxxx_*.sql`
file sorts *before* any `migration*.sql` file (`'2' < 'm'` in ASCII), so
on a truly fresh/clean database, these two files would have run **last**
— after their renumbered counterparts had already created the same
objects — and failed outright:

- `migration2_part_b.sql` re-runs `CREATE POLICY "<name>" ON <table>` for
  policies `20240002_rls_policies.sql` already created. `CREATE POLICY`
  has no `IF NOT EXISTS`/`OR REPLACE` form in Postgres, so this errors
  with "policy already exists."
- `migration3_functions_triggers.sql` re-runs
  `CREATE SEQUENCE order_number_seq` (no `IF NOT EXISTS`), which
  `20240003_functions_triggers.sql` already created earlier in the same
  run — same class of hard failure.

Either failure would abort that migration file, meaning **none** of its
other statements would apply either — for `migration3`, that includes
`handle_new_auth_user()`, the trigger that creates a `public.users`
profile row on signup. A fresh-database reconstruction that hit this
would leave new-user signup broken.

**This does not affect the live, already-running production database** —
its schema was built up incrementally over real time, not by replaying
this whole folder from empty, so whatever state it's actually in isn't
touched by moving these files. Archiving (not deleting) them here keeps
the historical record available while making the `migrations/` folder
Supabase actually scans safe to replay from a clean database.

**[MANUAL VERIFICATION REQUIRED]**: before this is fully closed out,
check the live Supabase project's migration history (Studio → Database →
Migrations, or `supabase migration list` against the linked project) to
confirm whether `migration2_part_b` / `migration3_functions_triggers`
were ever tracked there under their original filenames. If so, this is
purely informational (nothing to reconcile — the live DB already has the
correct final state via whatever route it was actually built through).
If a *fresh* environment is ever provisioned from this repo (staging,
disaster recovery, a new region), the reconstruction should work cleanly
now that these two are out of the active `migrations/` folder.
