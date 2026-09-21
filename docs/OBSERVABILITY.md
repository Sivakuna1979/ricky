# FoodTaxi Observability

Written during Phase N. Deliberately built on what Vercel already gives
this deployment for free (native stdout/stderr capture, deployment/runtime
logs) rather than forcing a paid logging/monitoring SaaS. If the project
later adopts one (Sentry, Datadog, Axiom, etc.), the pieces below are
designed to feed it with no code change — they just need a log drain or
SDK wired to the existing structured output.

## 1. Structured logging (`lib/logging.ts`)

`log.info/warn/error({ scope, action, status, businessId?, requestId?, ... })`
writes one JSON line per call via `console.log/warn/error`. Vercel
captures this natively — no setup required to see it in the dashboard's
Runtime Logs, and a log drain can be pointed at it later without any code
change.

**Rule for callers** (carried over from Phase L's payment-logging safety
rule, generalised): never log a full request body, a secret/token/password,
or raw card/payment details. Only IDs and short descriptive strings.

Currently wired into `app/api/webhooks/whatsapp/route.ts` (signature
rejection, top-level processing failure) as the reference example. Not
yet retrofitted across every route — this is infrastructure for future
use, not a claim that every code path already emits structured logs.
Extending coverage to other high-value paths (payment webhooks, order
creation failures, AI tool-call failures) is a natural next step but
wasn't blanket-applied this phase to avoid touching ~250 route files
under time pressure with no live environment to verify nothing broke.

## 2. Request correlation IDs

`middleware.ts` sets (or forwards, if already present from an upstream
proxy) an `x-request-id` header on every response. This lets a single
request be traced across Vercel's own request log and any
`log.*({ requestId })` lines emitted while handling it. It is **not**
currently threaded into route handlers automatically (Next.js route
handlers don't have middleware-injected context the way some frameworks
do) — a handler that wants to log with the same id must read it back off
`req.headers.get('x-request-id')` and pass it through explicitly. This is
additive infrastructure, not a claim that every log line is already
correlated.

## 3. Health / readiness

`GET /api/health` — confirms the database is reachable
(`businesses` select, limit 1) and returns `{ status, db, latencyMs }` or
a 503. No secrets, versions, or config leaked. Intended for an uptime
monitor or Vercel's own health-check wiring.

**[MANUAL VERIFICATION REQUIRED]**: wire this into whatever uptime
monitor the project owner uses (UptimeRobot, Better Uptime, Vercel's own
monitoring, etc.) — this phase only built the endpoint, it can't itself
configure an external monitor.

## 4. Error monitoring

No error-tracking SaaS (Sentry etc.) is currently integrated. Given the
phase's explicit instruction not to force a paid service, this wasn't
added — Vercel's own Runtime Logs + Errors tab already surfaces unhandled
exceptions and 5xx responses without any extra setup, which is the
provider-neutral baseline this phase relies on.

**[MANUAL VERIFICATION REQUIRED / recommended follow-up]**: if the
project owner wants proactive alerting (not just a dashboard someone has
to remember to check), Sentry's free tier integrates with Next.js in a
few lines and would be the natural next step — a decision for the owner,
not assumed here.

## 5. Alerting

No alert rules exist yet beyond whatever Vercel's dashboard shows
passively. Building "actionable, not noisy" alerting genuinely needs a
live environment to tune thresholds against real traffic patterns — doing
this blind in a sandbox risks exactly the alert-fatigue outcome the phase
explicitly warned against. **Recommended starting set once live data
exists**: 5xx rate on `/api/orders/*` and `/api/pos/*` (core ordering),
Stripe/WhatsApp webhook failure rate, cron job failure
(`/api/cron/automations` non-200), `/api/health` returning 503.

## 6. Database — indexes, N+1, transactions

Not re-audited from scratch this phase — the established pattern from
every prior phase (idempotency via UNIQUE-constraint atomic claims,
`SECURITY DEFINER` RPC functions as the sole writer of cached aggregate
values, e.g. `apply_stock_movement()`) already avoids the check-then-act
race conditions and multi-record consistency issues a fresh audit would
be looking for. No new N+1 patterns were introduced by this phase's
changes (this phase added no new data-fetching UI).

## 7. Job reliability

`app/api/cron/automations/route.ts` (Phase D) already has the durable
pattern this item asks for: `claimRun()`'s `UNIQUE(business_id,
trigger_key)` constraint prevents duplicate side-effects if the same
hourly tick fires twice or Vercel retries a slow invocation. Not modified
this phase — confirmed still correct on re-read.

## 8. Frontend / cache / realtime performance

Not re-benchmarked this phase (no browser available). No changes were
made to Realtime subscription patterns, GPS update frequency, AI cost
controls, or caching — everything here is carried over unchanged from
Phases G/J/K, which already documented their own performance
considerations.
