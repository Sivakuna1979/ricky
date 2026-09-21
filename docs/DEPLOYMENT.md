# FoodTaxi Deployment

Written during Phase N.

## 1. Platform

- Vercel, Next.js 14 (App Router), Node 20.x (`apps/web/package.json`
  `engines.node`).
- Two `vercel.json` files exist — one at the repo root, one in
  `apps/web/`. They previously drifted (only the root had the
  automations `crons` block); both now define the same `crons` entry,
  reconciled this phase, so the cron job registers regardless of which
  one Vercel's project-root setting actually reads. **[MANUAL
  VERIFICATION REQUIRED]**: confirm in the Vercel project settings which
  directory is actually configured as the project root, and consider
  deleting whichever `vercel.json` isn't read, to remove the duplication
  risk permanently rather than just keeping both in sync by hand going
  forward.
- Supabase: Postgres + Auth + Realtime + RLS. No Supabase Storage usage
  anywhere in this codebase (confirmed by repo-wide grep) — every
  upload/document feature either doesn't exist yet or uses a different
  mechanism; this was re-confirmed this phase, not assumed.

## 2. Build

- `npm run build` (root `vercel.json`: `cd apps/web && npm install && npm run build`).
- `npm run type-check` (`tsc --noEmit`) is clean as of this phase's final
  commit — verified in this sandbox.
- `npm run lint` has a pre-existing gap documented by every prior phase:
  it fails non-interactively in this sandboxed environment (an
  interactive ESLint config prompt). Not a regression introduced by this
  phase. **[MANUAL VERIFICATION REQUIRED]**: run lint in a real
  interactive terminal or CI environment where the prompt can be
  answered once, to get a real lint result.

## 3. Environment variables

Names only, never values, per this phase's own constraint. New this
phase:

- `WHATSAPP_APP_SECRET` — Meta App Secret (App Dashboard → App Settings
  → Basic), used to verify the `X-Hub-Signature-256` header on inbound
  WhatsApp webhooks. Optional but strongly recommended — see
  `docs/SECURITY.md` §5.

Existing (from prior phases, listed here for completeness — see each
phase's own documentation for full detail): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_CONNECT_WEBHOOK_SECRET`, `GOOGLE_PLACES_API_KEY`,
`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
`CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY` (or equivalent
email provider), VAPID keys for web push.

**Dev/preview/prod separation**: Vercel's per-environment variable
scoping is the mechanism (Production / Preview / Development each get
their own values in the Vercel dashboard). **[MANUAL VERIFICATION
REQUIRED]**: confirm preview deployments actually point at a separate
Supabase project (or at minimum separate Stripe/WhatsApp test
credentials) rather than production — this can't be verified from a
sandboxed session with no access to the live Vercel project settings. If
preview currently shares production Supabase/Stripe, that's a real
isolation gap the owner should close before relying on preview for
testing.

## 4. Migrations

Every schema change ships as a new, additive, numbered file in
`supabase/migrations/` (never edited in place after being written — see
every prior phase for this convention). None of this phase's migrations
have been applied to any live database from this sandbox (no DB access)
— **[MANUAL ACTION REQUIRED]**: run `20240062_phase_n_hardening.sql`
against the project's Supabase database the same way every prior phase's
migration was applied.

### Migration safety pattern (for future risky schema changes)

For a genuinely risky change (dropping/renaming a column or table that's
actively read/written, changing a type in a way that could truncate
data) the safe sequence is:

1. **Expand** — add the new column/table alongside the old one, nothing
   removed yet.
2. **Compatible code** — ship application code that writes to both
   old and new (or reads new with a fallback to old), so the app works
   correctly regardless of which schema version is live during rollout.
3. **Backfill** — a one-off script/migration populates the new
   structure from existing data.
4. **Switch** — application code moves to using only the new structure.
5. **Verify** — confirm in production that nothing is still reading/
   writing the old structure (logs, a temporary assertion, or a
   monitoring period).
6. **Contract** — only now drop the old column/table, in its own
   migration, separate from the switch.

No migration in this codebase's history has needed this full sequence yet
(every phase's schema changes have been additive — new tables/columns,
never a destructive rename/drop of live data) — this is documented as
guidance for whenever that changes, not a retroactive redo of past
migrations.

### Rollback limits

Vercel deployments can be rolled back instantly (redeploy a previous
build). **Database migrations cannot be rolled back that way** — a
migration that ran against production and was then followed by writes
using the new schema cannot simply be "undone" by rolling back the app
code, because the data itself may already be in the new shape. This is
why the expand/contract pattern above matters for risky changes: it keeps
every intermediate state safe to roll the *app* back to, right up until
the final contract step (which should only happen once the new state is
confirmed stable).

## 5. Feature flags / kill switches

No feature-flag system exists in this codebase today. Where a
non-critical feature needs an emergency off switch in the future
(marketing sends, AI-initiated writes, document processing, an
accounting sync, a future payment integration, group bulk operations),
the natural mechanism is a server-side check (an env var or a DB-backed
settings row, following the existing `automation_settings` pattern from
Phase D) gating that specific code path — **never core ordering**. If
writes are ever disabled for a feature, the API must return an honest
error, never a fake "success" — the same principle behind this phase's
whole "never claim results that weren't verified" instruction applied to
runtime behaviour, not just this session's own reporting.

## 6. Maintenance mode

No maintenance-mode mechanism exists today. Not built this phase (no
concrete need identified, and building one speculatively risks the exact
"silently disable core ordering" failure mode this phase's constraints
explicitly warn against). If needed later, it should be scoped narrowly
(e.g. block new order creation with a clear customer-facing message)
rather than a blanket site-down switch, and should never make
`/api/health` report healthy while orders are actually blocked.
