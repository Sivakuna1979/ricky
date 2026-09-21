# FoodTaxi Backup & Disaster Recovery

Written during Phase N. **This sandbox has no access to the live Supabase
project dashboard**, so nothing about the actual backup plan, retention
window, or point-in-time-recovery (PITR) availability can be confirmed
from here — those depend entirely on which Supabase pricing tier the
project is on. Everything marked **[REQUIRES OWNER CONFIRMATION]** below
must be checked directly in the Supabase dashboard by the project owner.
No retention period, RPO, or RTO number is invented in this document.

## 1. What backup capability actually exists — unknown from here

Supabase's backup behaviour depends on plan tier:

- **Free tier**: no automated backups at all.
- **Pro tier**: daily automated backups, typically retained ~7 days
  (verify the exact number for the current plan in the dashboard —
  Supabase has changed these numbers across pricing revisions, so a
  number written here from memory could be wrong).
- **Team/Enterprise tiers**: PITR (point-in-time recovery) may be
  available, letting a restore target a specific timestamp rather than
  only the last daily snapshot.

**[REQUIRES OWNER CONFIRMATION]**: log into the Supabase dashboard →
Project Settings → Database → Backups, and record here (a) which plan
this project is on, (b) whether PITR is enabled, (c) the actual retention
window shown. Until that's done, this project's real backup coverage is
unknown, not "fine" — do not assume Pro-tier defaults without checking.

## 2. RPO / RTO — a business decision, not invented here

RPO (Recovery Point Objective — how much data loss is acceptable) and RTO
(Recovery Time Objective — how long an outage can last before it's
unacceptable) are business decisions that depend on what backup tier is
actually active (§1) and what the owner is willing to pay for. This
document does not invent numbers for either. Once §1 is confirmed, the
owner should decide and record target RPO/RTO here, and confirm the
actual plan tier can meet them (e.g. daily-only backups imply an RPO of
"up to 24 hours," not minutes — if that's unacceptable, PITR or a
higher tier is needed).

## 3. Restore runbook (structure, not a tested procedure)

This is the shape a restore should follow — it has **not** been executed
against this project, in this sandbox or anywhere else, because doing so
safely requires a non-production environment this session doesn't have
access to.

1. **Assess** — confirm the actual incident (data corruption, accidental
   deletion, bad migration) and its scope before touching anything.
   Check `audit_logs` for the actor/action/timestamp if the cause is a
   bad write, not infrastructure failure.
2. **Stop further writes if the incident is ongoing** — for a bad
   migration or a runaway job, this may mean disabling the relevant
   Vercel Cron trigger or, for a severe case, pausing the affected
   feature via a kill switch (see `docs/runbooks/README.md`) before
   restoring, so the restore isn't immediately re-corrupted by whatever
   caused the original incident.
3. **Identify the recovery point** — the latest backup/PITR timestamp
   *before* the incident, from the Supabase dashboard.
4. **Restore** — via the Supabase dashboard's restore flow (or `pg_restore`
   from an exported dump, if manual). This is almost always safer done
   into a **new** Supabase project first, not in-place onto production,
   so the restored data can be verified before cutting traffic over —
   **never restore directly over the live production database without
   verifying the restored state first**, per this phase's non-negotiable
   "no production-data deletion, no destructive migration without
   approval" constraint.
5. **Validate** — spot-check the restored data against what's known about
   the incident window: order counts, recent `audit_logs` entries,
   payment/finance row counts, a handful of individual records the owner
   can recognise as correct or wrong.
6. **Resume** — cut traffic to the restored database (update env vars /
   Vercel project settings), re-enable anything disabled in step 2,
   confirm `/api/health` is green, then monitor closely for the next
   period rather than considering the incident closed the moment traffic
   resumes.

## 4. Restore drill — not performed

The phase asks for a non-production-only restore drill "if safely
possible." It was not safely possible in this sandbox: there is no
non-production Supabase project, no database credentials, and no network
egress to Supabase at all in this environment. **This was not attempted
and is not claimed as tested.** **[REQUIRES OWNER ACTION]**: run this
runbook end-to-end against a throwaway/staging Supabase project (not
production) to actually verify it works and to fill in real numbers for
how long each step takes — that duration is what actually determines RTO,
not a guess.

## 5. Data export / customer deletion — integrity constraint

Any customer data export or deletion flow (existing or future) must never
corrupt finance or audit-log history — a deleted customer's past orders,
payments, and audit trail need to remain intact for accounting/legal
reasons even after the customer's own PII is removed or exported. This is
a design constraint to hold future work to, not a new feature built this
phase (no customer-initiated export/deletion UI exists yet in this
codebase, confirmed by grep).

## 6. GPS/location data retention

`live_locations` (Phase G) stores van GPS pings. No explicit retention/
purge policy exists in the schema today (no TTL, no scheduled cleanup
job). This is a minimisation gap worth addressing, but this phase doesn't
invent a retention period out of nowhere — that's a decision for the
owner (how long does the business actually need historical GPS trails
for route-intelligence/reporting purposes?) once made, a scheduled
cleanup job following the existing cron pattern
(`app/api/cron/automations`) is the natural implementation.
