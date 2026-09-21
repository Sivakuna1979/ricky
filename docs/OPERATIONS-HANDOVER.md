# FoodTaxi Operations Handover

Written during Phase O, for whoever operates FoodTaxi day-to-day after
this build. A future developer or operator should be able to run this
platform from this document plus the ones it links to, without relying
on undocumented knowledge from this build process.

## 1. What runs where

- **Application**: Next.js 14 (App Router), deployed on Vercel, at
  `apps/web` in this monorepo. `apps/agent` and `apps/youtube` are
  separate, unrelated apps in the same repo — FoodTaxi work should never
  touch them.
- **Database**: Supabase (Postgres + Auth + Realtime + Row-Level
  Security). This is the single source of truth for every piece of data
  — there is no separate cache-of-record anywhere; every dashboard/report
  composes from live tables at query time (established convention since
  Phase K).
- **AI**: Anthropic Claude API, called server-side only, never from the
  browser.
- **Payments**: Stripe — one account for FoodTaxi's own billing (business
  subscriptions + the £29.99 event fee), Stripe Connect Express for
  Stripe Terminal (Phase L-B, per-business, no FoodTaxi commission).
- **Messaging**: Meta WhatsApp Cloud API (ordering channel), Resend
  (transactional email), Twilio (optional SMS, no-ops if unconfigured),
  Web Push (VAPID).
- **Maps/location**: Google Places API (business discovery, address
  lookup), Leaflet + CARTO/OpenStreetMap tiles (customer-facing maps —
  chosen over Google Maps JS to avoid a client-side Maps API key
  requirement), postcodes.io + Nominatim (UK postcode/geocoding, both
  free/keyless).

## 2. Source of truth

Every number a dashboard shows is computed from the live database at
request time — `orders`, `payments`, `stock_movements`, etc. — never from
a cached/precomputed summary table that could drift. This is a
deliberate, repeated architectural choice across every phase (see
`docs/FOODTAXI-TECHNICAL-BASELINE.md`'s phase sections for the specific
reasoning each time it came up). If a future feature is tempted to add a
cache for performance, it must still be provably reconcilable against the
live source, not a second, potentially-diverging copy.

## 3. Critical integrations and their failure modes

| Integration | What breaks if it's down | Where to look |
|---|---|---|
| Supabase | Everything — the whole app reads/writes here | Supabase status page, Vercel Runtime Logs |
| Stripe (billing) | New subscriptions/trials can't start; existing access is unaffected until `current_period_end` | Stripe Dashboard → Webhooks (delivery log) |
| Stripe Terminal/Connect | POS card payments fail; cash/recorded-card still work | Same as above, separate webhook |
| Anthropic | AI chat/assistant features degrade to an error, everything else unaffected | Anthropic status page |
| WhatsApp (Meta) | WhatsApp ordering channel stops; online/POS ordering unaffected | Meta App Dashboard → Webhooks |
| Google Places | Business discovery/import tooling degrades; core ordering unaffected | N/A — not customer-facing |
| Resend | Transactional emails stop; in-app notifications/push still work | Resend dashboard |
| Web Push | Push notifications stop; in-app notification centre still works | N/A |

## 4. Scheduled jobs

One Vercel Cron job: `GET /api/cron/automations`, hourly (`0 * * * *`),
secret-gated via `CRON_SECRET`. Runs every business's due automations
(stock/hygiene/vehicle/staff reminders, daily/EOD/weekly reports,
marketing suggestions, event follow-ups) — each guarded by
`claimRun()`'s `UNIQUE(business_id, trigger_key)` constraint, so a
duplicate/retried tick can't double-send anything. See
`docs/FOODTAXI-TECHNICAL-BASELINE.md` §27 for the full automation list.

## 5. Post-launch monitoring plan

No invented thresholds — these are the things worth watching, not
pre-decided numeric alert levels (which need real baseline traffic to
set honestly).

- **First hour**: `/api/health`, Vercel deployment status, first few real
  orders processing correctly end-to-end.
- **First trading session**: order volume looks sane for whichever
  business is live, no repeated errors in the same code path, WhatsApp/
  push notifications actually arriving.
- **First day**: cron job's first automatic run completes without error,
  subscription/billing webhook events processing correctly, no
  cross-tenant report from the pilot business.
- **First week**: error rate trend, any recurring webhook failure,
  whether the in-memory rate limiter is causing any false positives for
  real users (check for unexpected 429s in logs).

Watch: orders, errors (Vercel Errors tab), webhook delivery success
(Stripe/Meta dashboards), cron job success, notifications, subscription
events, DB health (`/api/health`), Realtime connection stability, AI
failures, and any support ticket that comes in.

## 6. Analytics baseline

Not captured here — this sandbox has no access to live production data
to report real numbers, and inventing plausible-looking numbers would
violate this phase's own instruction. **[MANUAL ACTION]**: once live,
record actual registered-business count, active-van count, order volume,
error rate, and DB size as the real launch baseline, for future
comparison.

## 7. Support / incident workflow

1. Business reports an issue (however it reaches the owner/support
   contact).
2. Capture: which business, which van, which order/reference if
   applicable.
3. Triage severity using `docs/runbooks/README.md`'s SEV levels.
4. Check diagnostics: Vercel logs (filter by the request/correlation id
   if available — `lib/logging.ts` + `x-request-id` from Phase N),
   Supabase logs, relevant `audit_logs` rows.
5. Contain if needed (see `docs/runbooks/README.md`'s security-incident
   steps for a credential/data-exposure case specifically).
6. Resolve, following this repo's existing conventions (additive
   migrations only, no RLS weakening, no destructive change without
   explicit approval).
7. Communicate back to the business.
8. For anything SEV-1/SEV-2, write a short postmortem — this becomes the
   next real runbook entry, since `docs/runbooks/README.md` is
   deliberately thin until real incidents earn it real scenario-specific
   content.

## 8. Launch owner contacts

Roles, not credentials — **[MANUAL ACTION: fill in real names/contacts]**:

- Platform owner: _(not configured in this sandbox — fill in)_
- Technical contact: _(fill in)_
- Billing contact: _(fill in)_
- Support contact: _(fill in)_
- Incident decision maker: _(fill in)_

## 9. Manual provider configuration (cannot be done from code)

- Stripe Dashboard: live API keys, webhook endpoint registration, the
  £19.99/month recurring Price object (`STRIPE_FOODTAXI_MONTHLY_PRICE_ID`
  must point at it), Stripe Connect Express platform settings for
  Terminal.
- Meta App Dashboard: WhatsApp Business API production access, webhook
  subscription, App Secret (`WHATSAPP_APP_SECRET`).
- Supabase Dashboard: backup/PITR tier confirmation, custom domain if
  used, connection pooling settings for production load.
- DNS: production domain pointing at Vercel.
- Google Cloud Console: Places API key, billing alerts (this is a
  pay-per-call API — see the cost-abuse fix in Phase N that gated the
  two endpoints that were burning this budget unauthenticated).
- Any accounting integration (Xero/QuickBooks) OAuth app registration.
- Web Push: VAPID key pair generation (one-time, if not already done).

## 10. Technical debt register

**RELEASE BLOCKER**: none remaining as of this phase's final commit.

**Next 30 days**:
- Run the live E2E test pass this sandbox couldn't perform
  (`docs/LAUNCH-CHECKLIST.md`'s testing section).
- Confirm and, if needed, upgrade the Supabase backup/PITR tier.
- Run a real restore drill.

**Next 90 days**:
- A dedicated Next.js 15 migration — Next 14's remaining critical CVEs
  have no fix inside the 14.x line (documented in `docs/SECURITY.md` §9).
- Move `lib/rateLimit.ts` to a distributed store (Upstash Redis) if
  real traffic shows the in-memory limiter's per-instance nature is
  actually being exploited, rather than pre-emptively.
- Decide a GPS/location data retention policy and build the
  corresponding cleanup job (`docs/BACKUP-AND-RECOVERY.md` §6).
- Address the business-claim flow's identity-verification gap
  (`docs/SECURITY.md` §3) — a product decision, not urgent.

**Longer term**:
- Remove the confirmed-dead Stripe Connect marketplace experiment code
  (`app/api/payments/create-intent`, `app/api/subscriptions`) once
  confirmed truly unused in any future plan.
- Consider a nonce-based CSP to drop `'unsafe-inline'`/`'unsafe-eval'`
  once live-verified safe to tighten.
- Clean up the three cosmetic duplicate-numbered migration-file pairs
  (`20240032`/`33`/`34`) if a future contributor finds them confusing —
  not urgent, verified non-conflicting.

## 11. Known limitations (honest, not exhaustive marketing copy)

- No native app — PWA only.
- No live card payment beyond Stripe Terminal (approved, Phase L-B) —
  never tested against real hardware in any sandboxed session.
- No distributed rate limiting — in-memory, per-instance only.
- No error-tracking SaaS (Sentry etc.) integrated — Vercel's native logs
  are the current baseline.
- GPS location history has no retention/purge policy yet.
- Accounting integrations (Xero/QuickBooks) are optional and untested
  against a live organisation in this phase (would require writing to a
  real accounting org, which this phase's own instructions say not to do
  merely for QA).

## 12. Future roadmap options (not started — for the owner to prioritise)

Per this phase's explicit instruction, none of these are started merely
because Phase O is complete:

- Approved real card-terminal integration expansion (beyond the current
  Stripe Terminal scope).
- Native app packaging (TWA/Capacitor) if PWA adoption data suggests it's
  worth it.
- Advanced marketplace/discovery expansion.
- Deeper accounting integrations.
- Enterprise/franchise billing (a new commercial model — explicitly out
  of scope without separate approval, per every phase's constraints).
- Advanced demand forecasting.
- Internationalisation (this build is UK-specific throughout — GBP,
  Europe/London timezone, UK postcode formats).
- Additional payment provider evaluation, if Stripe Terminal's real-world
  results suggest a second option is warranted.
