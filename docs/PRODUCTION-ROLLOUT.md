# FoodTaxi Production Rollout Plan

Written during Phase O. This is a plan to follow, not a claim that any
step in it has been executed — this sandbox has no access to the live
Vercel/Supabase/Stripe/WhatsApp dashboards needed to actually carry it
out.

## 1. Ordered deployment plan

1. **Backup/recovery confirmation** — confirm the live Supabase project's
   actual backup tier and, ideally, take a manual snapshot immediately
   before deployment if the plan supports it. See
   `docs/BACKUP-AND-RECOVERY.md`.
2. **Environment verification** — confirm every variable in
   `docs/PHASE-O-LAUNCH-READINESS.md` §4 is set correctly in Vercel
   Production, and that Preview uses separate (test-mode) credentials.
3. **Provider/webhook verification** — confirm Stripe (billing +
   Terminal if going live), WhatsApp (Meta App Dashboard), and any
   configured accounting integration's webhook URLs point at the real
   production domain, not a preview URL or localhost.
4. **Migration review** — confirm `supabase/migrations/` (excluding
   `_archive/`) matches what's expected; apply migration
   `20240062_phase_n_hardening.sql` if not already applied (see Phase N's
   completion report — it was written but this sandbox cannot confirm it
   was ever run against the live database).
5. **Migration deployment** — apply any pending migration via the
   Supabase CLI/dashboard.
6. **App deployment** — merge/deploy to the branch Vercel Production
   tracks; confirm the build succeeds (this sandbox's own `npm run build`
   passes clean as of this phase's final commit, which is the strongest
   pre-deployment signal available without live infrastructure).
7. **Health check** — hit `/api/health` on the newly deployed URL,
   confirm `{ status: 'ok' }`.
8. **Critical smoke tests** — see §4 below. Run before opening to real
   traffic.
9. **Business pilot** — see §2 below, before a broader rollout.
10. **Monitoring** — watch Vercel Runtime Logs/Errors closely for the
    first trading session (see `docs/OPERATIONS-HANDOVER.md` §5 for the
    observation windows).
11. **Broader rollout** — once the pilot's success criteria (§3) are
    met.

## 2. Change freeze

During the launch window (from the start of the pilot through the
broader-rollout decision), only release-blocking security or
data-integrity fixes should ship — no unrelated feature work. This keeps
the surface being observed stable enough that a problem found during the
pilot can be attributed to the launch itself, not to an unrelated change
landing at the same time.

## 3. Pilot rollout

Prefer a small, explicitly-authorised pilot (one business, or one small
group if the group feature is in scope for launch) over an instant
all-businesses cutover — this codebase's multi-tenant model means a
pilot business's experience is representative of every other business's,
without the blast radius of a platform-wide issue. **Do not move a real
existing business into a pilot role, or change its access, without the
owner's explicit approval** — the pilot participant should be chosen and
confirmed by the owner, not decided here.

### Success criteria (factual, not a vanity score)

- Pilot business can log in and reach their dashboard.
- Pilot business can take at least one real order end-to-end (any
  channel — online, POS, or WhatsApp) and see it reflected correctly in
  Orders/Finance.
- POS and KDS (if used) work for a real shift.
- Live tracking (if used) shows a real GPS position to a real customer.
- Subscription/billing state is correct for the pilot account (trial or
  active, matching what was actually set up for them).
- Any notification the pilot business or their customers should receive
  (order confirmation, push, WhatsApp reply) actually arrives.
- **Zero cross-tenant issue observed** — the pilot business never sees
  another business's data, and vice versa.
- Error rate stays low enough that nothing in Vercel's Errors tab
  suggests a systemic problem (a specific numeric threshold isn't set
  here — there's no baseline traffic yet to calibrate one against
  honestly; the owner should judge this qualitatively for the pilot and
  set a real number once there's a baseline).
- No data-integrity issue (duplicate order, lost order, wrong total,
  stock/loyalty double-application) observed.

## 4. Post-deployment smoke tests

Run immediately after any production deployment, before/alongside the
pilot. Every check should be read-only or use a clearly-marked test
context that doesn't generate a real charge or send a real customer
message unnecessarily:

- Public site loads (`/`).
- A public van/menu page loads (`/van/[slug]`).
- Login works (`/login`) — for a real staff/owner test account, not a
  synthetic one that doesn't exist in the DB.
- Business dashboard loads after login.
- `/api/health` returns 200.
- POS page loads (doesn't need a real sale to confirm the page itself
  renders and reaches the DB).
- KDS page loads.
- Tracking page loads for a van with `tracking_status = 'live'`, if one
  exists.
- Billing/subscription page loads and shows correct state for a known
  test account.
- Finance dashboard loads.
- Stock dashboard loads.
- CRM dashboard loads.
- AI chat responds to a simple, harmless question ("what's today's
  date") without erroring — confirms the Anthropic API key and DB
  context resolution both work, without needing a real business
  question.
- Group dashboard loads, if group features are in scope for launch.

## 5. Rollback triggers

Any of the following should trigger an immediate rollback/containment
decision, not a "watch and see":

- Cross-tenant data leak (one business/customer sees another's data).
- Wrong prices or totals on a real order.
- Duplicate charges (if a live card-payment provider is active — Stripe
  Terminal, per its own already-approved scope).
- Order loss or duplication.
- Stock corruption (a stock movement applied twice, or not at all, for a
  real sale).
- Subscription billing corruption (wrong plan, wrong trial state, a
  business incorrectly locked out or incorrectly given access).
- A major auth outage (nobody can log in).
- A critical migration issue (a migration fails partway, or succeeds but
  leaves data in an inconsistent state).

## 6. Rollback execution

- **App-level**: Vercel supports instant rollback to the previous
  deployment — this is the first, lowest-risk lever and should be tried
  before touching the database in almost every case.
- **Database-level**: per `docs/DEPLOYMENT.md` §4's migration-safety
  pattern, this codebase's migrations have all been additive (confirmed
  this phase — zero `DROP`/`RENAME`/type-change statements across the
  entire history), so a Vercel app-level rollback should be sufficient
  for any issue caused by new application code reading/writing a schema
  correctly. **Never blindly run a migration in reverse** — if a schema
  change genuinely needs undoing, that's a new, carefully-considered
  migration of its own, written and reviewed like any other, not an
  automatic "undo."
- If data was actually corrupted (not just a code bug), see
  `docs/BACKUP-AND-RECOVERY.md`'s restore runbook.
