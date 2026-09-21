# Phase O — Launch Readiness

Written during Phase O. Same sandbox constraint that governed Phase N
applies here and is even more binding for this phase: **there is no
browser, no live/staging database, and no network egress to Vercel or
Supabase in this session.** Every finding below is either (a) verified by
reading source code, running `type-check`/`build`, or static analysis of
migrations, or (b) explicitly marked as requiring live-environment
verification. Nothing in this document claims a live end-to-end test was
run when it wasn't — per this phase's own repeated, explicit instruction.

## Executive summary

This pass re-inspected the actual implementation (not just prior
documentation) across every phase and found **three real, previously
undetected issues**, all now fixed and verified by `type-check`/`build`:

1. **A commercial-model violation**: the Google-Places business-claim flow
   (`app/api/places/claim/route.ts`) granted a hardcoded 14-day trial
   against a plan named `'Starter'` — a plan that doesn't exist in this
   single-plan system (`FOODTAXI_PLAN_NAME = 'FoodTaxi Business'`). In
   practice this meant anyone registering through that flow got **no
   subscription row created at all**, silently swallowed by an empty
   `catch {}`. Fixed to use the same shared `FOODTAXI_TRIAL_DAYS` (3) and
   `FOODTAXI_PLAN_NAME` constant every other registration path already
   uses.
2. **A production-facing information leak**: the login page
   unconditionally rendered a debug panel to every visitor showing
   Supabase config state, auth error detail, session/cookie information —
   and separately used a hardcoded personal email string
   (`sivakuna@icloud.com`) client-side to decide the post-login redirect
   target. Neither was a real authorization bypass (`/admin`'s middleware
   gate was and remains the only actual authorization boundary), but both
   are real, now-fixed issues: the debug panel is gated to
   non-production builds only, and the redirect now queries the same
   `users.role` truth source `isSuperAdmin()` uses.
3. **A migration-reconstruction failure**: two legacy pre-renumbering
   migration files (`migration2_part_b.sql`, `migration3_functions_
   triggers.sql`) are confirmed-duplicate content of properly-numbered
   files that supersede them (`20240002_rls_policies.sql`,
   `20240003_functions_triggers.sql`), but were never removed. Because
   Supabase applies migrations in filename-lexicographic order, and
   `"2024..."` sorts before `"migration..."`, a from-scratch database
   reconstruction using this folder as-is would hit a hard SQL error
   (`CREATE POLICY`/`CREATE SEQUENCE` on an object that already exists)
   partway through. Archived (not deleted) into
   `supabase/migrations/_archive/` with a README explaining why — see
   that folder for the full evidence trail.

A fourth, smaller issue was also fixed: a hardcoded default
email/password pair in `app/api/admin/fix-user/route.ts` (already
`isSuperAdmin`-gated, so not externally exploitable, but a bad pattern —
now requires an explicit target email and generates a random one-time
password instead of a known constant).

A fifth, cosmetic-but-real issue: `LiveVanTracker.tsx`'s customer-facing
"arriving in ~X min" label was a straight-line-distance/fixed-speed
estimate presented with real-ETA language, while another file in the same
codebase (`lib/customer/liveStatus.ts`) explicitly documents the opposite
discipline. Reworded to "~X min est." — honest about being an estimate,
not a routed/traffic-aware ETA.

None of these are attacker-exploitable security bypasses (the RLS/auth
boundary itself was unaffected in every case), but the trial/plan bug is
a genuine commercial-model violation that would have silently broken
billing for a real subset of newly-registered businesses, and the
migration-reconstruction issue is a genuine disaster-recovery risk. Both
are exactly the class of finding this phase's audit exists to catch.

## Launch recommendation status: **READY WITH MANUAL ACTIONS**

Not "READY" — too much of this phase's required verification (live E2E
QA across ~60 flows, accessibility, device/browser matrix, load test,
restore drill) is genuinely impossible without live infrastructure this
sandbox doesn't have, and claiming otherwise would violate this phase's
own explicit instruction not to fabricate results. Not "NOT READY" either
— no release-blocking issue was found that code-level fixes couldn't
close, the build is clean, and every found issue was fixed in this same
pass. The manual actions below are what stands between this state and an
actual owner-approved go-live.

## 1. Phase A–N roadmap audit matrix

Verified by re-reading the actual current source for each area this
phase (not assumed from prior phase reports). "Tested" here means
automated (`type-check`/`build`) plus this session's own direct code
verification across many phases — never a live E2E claim.

| Phase | Approved scope | Implemented | Tested | Documented | Manual action outstanding | Known limitation | Release blocker |
|---|---|---|---|---|---|---|---|
| A | Core platform, auth, businesses, vans, orders, basic RLS | Yes | type-check/build clean | Yes (`FOODTAXI-TECHNICAL-BASELINE.md` §1-12) | None new | Pre-renumbering migration duplicates (fixed this phase) | None |
| B | Business subscription (£19.99/3-day trial) | Yes | Constant-level verified (`FOODTAXI_TRIAL_DAYS=3`); one call site bypassed it (fixed this phase) | Yes | Confirm live Stripe price id is set | None | None (was borderline until this phase's fix) |
| C | Business Operations (stock/suppliers/team/fleet) | Yes | type-check/build clean | Yes (§15) | None new | None found | None |
| D | Automation & Smart Operations | Yes | Idempotent via `claimRun()` UNIQUE constraint, re-confirmed Phase N | Yes (§27) | None new | None found | None |
| E | FoodTaxi AI + safe-action framework | Yes | Re-confirmed prompt-injection boundary holds | Yes (§47) | None new | Cannot live-test AI accuracy without API access to a live model call against real business data | None |
| F | Business Memory | Yes | Not re-tested this phase (no changes) | Yes (§66) | None new | None found | None |
| G | Route Intelligence | Yes | Not re-tested this phase | Yes (§67) | None new | None found | None |
| H | Finance | Yes | Not re-tested this phase; revenue calc confirmed to exclude event fee (§O31 check, this phase) | Yes (§68) | None new | None found | None |
| I | CRM/Loyalty/Promotions | Yes | Not re-tested this phase | Yes (§69) | None new | None found | None |
| J | Customer Experience/PWA/Push | Yes | ETA-wording issue found and fixed this phase | Yes (§70) | None new | None found | None |
| K | Command Centre | Yes | Not re-tested this phase | Yes (§71) | None new | None found | None |
| L | Payments & Integrations (incl. L-B Stripe Terminal) | Yes, Stripe Terminal approved and implemented | Not re-tested this phase (no changes) | Yes (§72, §72b) | Confirm Stripe Terminal hardware pairing live | Never tested against real hardware in any sandboxed session (documented since Phase L) | None |
| M | Franchise/Group | Yes | Not re-tested this phase | Yes (§73) | None new | None found | None |
| N | Production hardening | Yes | 12 missing-auth routes found+fixed, dependency/header/rate-limit hardening | Yes (§74, 6 dedicated docs) | 9 manual actions listed in `PHASE-N-PRODUCTION-READINESS.md` | Next.js 14 residual CVEs (documented technical debt) | None remaining |

## 2. Dead / experimental feature audit (O2)

Full detail from a dedicated grep-based agent pass; summarised here,
each item classified:

- `app/api/payments/create-intent/route.ts`, `app/api/subscriptions/route.ts`
  — self-documented `⚠️ INACTIVE` Stripe Connect marketplace experiments,
  confirmed zero frontend callers. **Not customer-visible** (no linked UI
  path reaches them) — satisfies O2's bar ("visible to production users
  must work, be labelled unavailable, or be hidden safely") by simply
  being unreachable. Left in place per this phase's own instruction not
  to aggressively delete historical/experimental code; flagged in the
  technical debt register below for eventual removal.
- `app/van/[slug]/board/page.tsx`, `components/van/VanProfileClient.tsx`
  — "Menu coming soon" placeholder text. **Customer-visible but honestly
  labelled** — satisfies O2's bar directly. No action needed.
- `lib/notify/channels.ts` WhatsApp automation channel — correctly
  disabled in the UI (`AutomationsCentre.tsx` disables the button), data
  model exists but delivery path doesn't. Honest, no action needed.
- `lib/utils/format.ts` — three exported functions (`slugify`,
  `formatDistance`, `getInitials`) with zero importers anywhere.
  Low-risk dead code, not customer-visible (not UI at all). Left in
  place — noted in technical debt register.
- **Login page debug panel** — was unconditionally visible to every
  production visitor. **Fixed this phase** (see Executive Summary).
- `app/api/debug/session` — was unauthenticated (inconsistent with every
  other `app/api/debug/*` route, all of which were `isSuperAdmin`-gated
  in Phase N). **Fixed this phase**: environment-gated instead of
  auth-gated, since its only real use is dev/preview login diagnostics
  for an ordinary (non-admin) user debugging their own sign-in.

No genuine duplicate route/component pairs found. No unwired
buttons/empty handlers found beyond the items above.

## 3. Feature-claim accuracy audit (O3)

- **Payment verification language**: correctly hedged everywhere checked
  — `receipt/[id]/page.tsx` only shows "verified by <provider>" when a
  real `provider_transactions` row confirms it; `FinanceDashboard.tsx`
  explicitly distinguishes "Card (recorded — not verified)" from
  provider-verified totals. No overclaim found.
- **ETA language**: `LiveVanTracker.tsx` overclaimed — **fixed this
  phase** (Executive Summary item 5).
- **Accounting integration language**: `IntegrationCentre.tsx` correctly
  hedges ("conservative summary sync... Mappings are labels, not tax
  advice") and status badges are driven by real connection-status fields,
  never a static "connected" claim. No overclaim found.
- **"Net profit"**: deliberately never used anywhere in the codebase —
  `lib/finance/cogs.ts` and `lib/finance/reports.ts` both explicitly
  state the management figure "is never called 'net profit'"; the actual
  label is "gross contribution." No overclaim found — this is a
  well-guarded area.

## 4. Production environment audit (O4)

Every environment variable name referenced in `apps/web` (grepped
directly from source, including indirect references via `requireEnv()`):

| Variable | Purpose | Classification |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Supabase core | MANUAL ACTION REQUIRED (confirm production project values are set) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_FOODTAXI_MODEL`, `ANTHROPIC_FOODTAXI_FALLBACK_MODEL` | FoodTaxi AI | MANUAL ACTION REQUIRED |
| `VOYAGE_API_KEY` | Business Memory document embeddings | MANUAL ACTION REQUIRED |
| `RESEND_API_KEY`, `EMAIL_FROM` | Transactional email | MANUAL ACTION REQUIRED |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | Optional SMS automation channel — correctly no-ops if unset (`lib/notify/channels.ts`) | OPTIONAL |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VAN_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` | WhatsApp ordering | MANUAL ACTION REQUIRED (`WHATSAPP_APP_SECRET` specifically new from Phase N — webhook signature enforcement stays off until it's set) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_FOODTAXI_MONTHLY_PRICE_ID` | Business subscription billing | MANUAL ACTION REQUIRED |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Stripe Terminal (Phase L-B) | MANUAL ACTION REQUIRED if Terminal is going live at launch, else NOT IN USE |
| `CRON_SECRET` | Vercel Cron auth | MANUAL ACTION REQUIRED |
| `GOOGLE_PLACES_API_KEY`, `GOOGLE_SEARCH_API_KEY`, `GOOGLE_CSE_ID` | Business discovery | MANUAL ACTION REQUIRED if discovery/import tooling is used post-launch, else OPTIONAL |
| `FSA_API_BASE_URL` | Food Standards Agency hygiene data | OPTIONAL (has a public default; only needs overriding if FSA changes their API) |
| `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_ENVIRONMENT` | Accounting integrations | OPTIONAL (only needed if a business actually connects Xero/QuickBooks) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web push | MANUAL ACTION REQUIRED |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL` | Absolute URL generation (redirects, Stripe success/cancel, emails) | MANUAL ACTION REQUIRED (must match the real production domain) |

No approved customer card-payment provider beyond the already-approved
Stripe Terminal — no new payment-provider env vars exist, and none were
added this phase, per the phase's explicit Critical Payment Rule.

## 5. Test/live mode separation (O5)

Cannot be verified from this sandbox — there is no code-level test/live
detection to audit (Stripe's SDK behaves identically regardless of which
key format is configured; "test mode" is purely a property of which key
value is set in the environment, not something the application code
branches on). **[MANUAL VERIFICATION REQUIRED]**: confirm in the Vercel
dashboard that Production environment variables use live Stripe/WhatsApp/
accounting credentials and Preview/Development use test credentials, and
that webhook endpoints registered in Stripe/Meta point at the correct
domain for each.

## 6. Domain / HTTPS / callbacks (O6)

`NEXT_PUBLIC_APP_URL` is used to build Stripe Checkout success/cancel
URLs (`app/api/events/pay/route.ts` and the subscription checkout route)
and OAuth redirect URIs for Xero/QuickBooks. Correctness of the actual
value, and whether Stripe/Meta/Xero/QuickBooks dashboards have the
matching callback URLs registered, **cannot be verified from this
sandbox** — those are live provider-dashboard settings.
**[MANUAL VERIFICATION REQUIRED]**.

## 7. Database migration reconstruction (O7) — see Executive Summary

Confirmed failure mode found and fixed (archived the two dead legacy
files). **[MANUAL VERIFICATION REQUIRED]**: the live Supabase project's
migration history should still be checked (see
`supabase/migrations/_archive/README.md`) to confirm this doesn't affect
anything already applied to production — it shouldn't, since production
was built up incrementally over real time, not by replaying this folder
from empty, but this sandbox has no way to confirm that directly.

## 8. Migration order / duplicates (O8)

Beyond the archived pair, three same-numbered-prefix pairs exist
(`20240032`/`20240033`/`20240034`, each appearing twice with different
suffixes) — verified via table-level diff that **no pair touches
overlapping tables**, so there is no functional conflict regardless of
which sorts first within each pair. Cosmetic numbering collision only,
not a risk. No action taken (renaming already-historical migration
filenames retroactively is unnecessary churn for zero functional
benefit).

## 9. Production data safety (O9)

- **Zero destructive schema operations** found across the entire
  migration history (no `DROP COLUMN`, `DROP TABLE`, `ALTER COLUMN...TYPE`,
  `RENAME`) — confirmed by grep across all 63 active migration files.
  Every schema change to date has been additive.
- One constraint-adding migration found (`20240049_foodtaxi_business_
  subscription.sql`, `SET NOT NULL`/`ADD CONSTRAINT`) — reviewed, applies
  to subscription-related columns introduced in the same migration (no
  pre-existing rows to violate it).
- One legitimate one-off data-repair migration exists
  (`20240035_seed_order_number_counter.sql`) — explicitly idempotent
  ("safe to re-run — only ever raises the floor"), not demo/fixture data.

## 10. Seed / demo data (O10)

No demo/fixture business records found anywhere in the migration history
(grepped for `INSERT INTO businesses`/similar patterns with no hits
beyond the legitimate order-counter repair above). Production does not
depend on any fake business record.

## 11–68. End-to-end QA — **sandbox constraint, honestly disclosed**

This sandbox has no browser and no live/staging database, so none of the
~60 E2E flows this phase's O11–O68 objectives ask for (business
registration, customer ordering, POS, offline POS, KDS, WhatsApp,
tracking, events, stock, staff, automations, finance reconciliation,
CRM/loyalty, AI accuracy, Business Memory, Route Intelligence, PWA/push,
group/franchise) could be executed live. Claiming otherwise would violate
this phase's own explicit instruction. What was actually done instead,
for every one of these domains:

- Re-read the relevant source code for the specific flow.
- Cross-checked it against the idempotency/isolation guarantees already
  verified in Phase N's RLS/auth audit (atomic UNIQUE-constraint claims,
  `SECURITY DEFINER` RPC functions as sole writer of cached values,
  business/group RLS scoping).
- Where a concrete, checkable claim existed (pricing, event-fee
  separation, ETA honesty, plan-name consistency), verified it directly
  against source — see Executive Summary and §O31/O32 note below for
  what that surfaced.

**No new correctness bug was found in this pass beyond the ones in the
Executive Summary and dead-code/feature-claim sections.** This is not the
same as a live-tested "PASS" — it's the strongest verification available
without live infrastructure, and it should not be read as a substitute
for actually running these flows in staging before launch.

**O31/O32 spot-check (event fee separation)**: confirmed
`lib/finance/revenue.ts` (the business revenue calculation module) only
reads from `orders` and `refunds` — never `event_applications` or
`event_requests`. The £29.99 event booking fee is structurally excluded
from business food revenue by construction, not by a filter that could
be forgotten. Confirmed correct.

**[MANUAL ACTION REQUIRED]**: run the actual E2E flows listed in O11–O68
against a staging environment before launch. A representative subset
(business registration → first order → POS sale → refund; WhatsApp order
→ confirmation; event request → application → £29.99 payment) would
cover the highest-value paths first if time is limited.

## 69–82. Final security / performance / backup / monitoring gates

- **O69 Security final gate**: cross-tenant/IDOR/role-escalation/mass-
  assignment/webhook-replay were the exact focus of Phase N's audit,
  re-confirmed still correct this phase (no regression introduced by
  Phase O's own changes — all fixes this phase either added an auth
  check or corrected a constant, never removed one). The three fixes in
  the Executive Summary were found *by* this gate, not despite it.
- **O70 Secret scan**: no hardcoded live secret values found anywhere in
  source (only `process.env.X` references, which are correct). One
  hardcoded *default password* pattern found and fixed (Executive
  Summary). No `.env`/`.env.local` file has ever been committed (checked
  via `git ls-files`, not just a working-tree grep).
- **O71 Security headers**: unchanged from Phase N, still present in
  `next.config.js`, `build` confirms no breakage. Live-browser
  verification still outstanding (`docs/SECURITY.md` §7).
- **O72 Rate limits**: unchanged from Phase N, `lib/rateLimit.ts` still
  applied to the same endpoints — re-confirmed present, not re-tested
  live.
- **O73 Accessibility, O74 Device/browser, O75 Responsive**: **BLOCKED —
  no browser in this sandbox.** Not claimed as tested, per this phase's
  explicit instruction not to fabricate device/browser testing.
- **O76 Performance, O77 Load gate, O78 Realtime gate**: no live traffic
  or browser to measure against; Phase N's own equivalent findings
  (BLOCKED for the same reason) still stand, unchanged.
- **O79 Backup gate, O80 Restore gate**: unchanged from Phase N — plan
  tier still unconfirmed from this sandbox, restore drill still not
  performed. See `docs/BACKUP-AND-RECOVERY.md`.
- **O81 Incident readiness**: `docs/runbooks/README.md` (Phase N) covers
  bad deployment/migration/order outage/security incident. Database/
  Vercel/provider-outage-specific runbooks are not separately written —
  the general incident process in that document applies to any of them
  (confirm service status, classify severity, contain, diagnose, fix,
  verify, write it down); a scenario-specific runbook for each provider
  wasn't built to avoid documenting untested hypothetical steps, per the
  phase's own reasoning in that document.
- **O82 Monitoring gate**: unchanged from Phase N — `/api/health` exists,
  no alert rules exist yet (needs live traffic to tune without alert
  fatigue, `docs/OBSERVABILITY.md` §5).
