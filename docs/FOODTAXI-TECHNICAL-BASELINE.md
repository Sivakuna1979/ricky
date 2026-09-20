# FoodTaxi Technical Baseline

Written at the end of Phase A (stabilisation). This is the reference point
for all future FoodTaxi development. Scope: `apps/web` only.

---

## 1. Architecture

```
Browser (customer / business owner / super admin)
        │
        ▼
Next.js 14 App Router (apps/web) — Vercel
   ├─ Server Components / Route Handlers (app/api/**)
   ├─ Client Components (dashboard, POS, kitchen, public van page)
   └─ middleware.ts — session refresh + the real /admin/* security gate
        │
        ▼
Supabase
   ├─ Postgres (RLS-scoped by business/van ownership)
   ├─ Auth (email/password)
   └─ Realtime (broadcast channels for POS↔customer-display sync;
                postgres_changes for live order/kitchen updates)
        │
        ▼
External services: Anthropic (AI), Resend (email), Twilio (SMS),
WhatsApp Cloud API, Stripe, Google Maps/Places, FSA, Companies House
```

Monorepo note: `apps/agent` and `apps/youtube` are separate, unrelated
products sharing this repo's git history and some root-level config
(`.env.example`, `package.json` workspace). They do not share runtime code
with FoodTaxi and were not touched during Phase A.

---

## 2. Database

Full table-by-table reference: `docs/foodtaxi-database.md`.

Summary: multi-tenant, RLS-enforced via `my_van_ids()` / `my_business_ids()`
/ `is_super_admin()` SECURITY DEFINER functions. As of Phase A
(`20240048_schema_reconciliation.sql`), the committed migrations fully
reconcile with the live schema — previously `menu_items` (flat `van_id` +
`category` shape) and the entire Events feature (`event_requests`,
`event_applications`, `event_blocked_dates`) existed live with no
corresponding CREATE TABLE migration. That gap is now closed.

Legacy, unused-but-present structures (documented, not deleted):
`menus` / `menu_categories` / `menu_item_options` / `menu_item_option_choices`,
`van_routes` / `route_stops`, `customers` (orders.customer_id is nullable
and unused by guest/POS/WhatsApp orders).

---

## 3. Authentication & roles

- Supabase Auth (email/password). A `users` row (with `role`) is
  auto-created on first login via `/api/auth/profile`.
- `user_role` enum has six values; only `super_admin` and `business_owner`
  are used by any actual code. `van_manager` / `driver` / `staff` /
  `customer` exist but nothing branches on them — every business is
  effectively single-owner-operated today.
- **Super admin authorization (centralised in Phase A):** `lib/isSuperAdmin.ts`
  is now the single source of truth, called from every route/page that
  previously hardcoded the admin email. The DB role for `sivakuna@icloud.com`
  was confirmed as `super_admin`, and the legacy email fallback has since
  been removed — this is now a pure database-role check.
- **The real `/admin/*` security boundary is `lib/supabase/middleware.ts`**
  (runs before any admin page renders) — not the individual page checks,
  which are a secondary safety net. This was also updated to use the
  centralised helper in Phase A.

---

## 4. External services

| Service | Purpose | Status |
|---|---|---|
| Supabase | DB/Auth/Realtime/Storage | ✅ core |
| Anthropic (Claude) | WhatsApp order parsing, menu/brand/schedule AI scans, event discovery | ✅ active |
| Resend | Receipts, marketing emails | ✅ active |
| Twilio | Order-ready SMS | ✅ active (degrades gracefully if unset) |
| WhatsApp Cloud API | Full AI ordering pipeline | ✅ active |
| Google Maps/Places | Live tracking, business discovery | ✅ active |
| FSA / Companies House | Business verification data | ✅ active |
| Stripe | See §5 | 🟡 partially active |

---

## 5. Current payment architecture

**Confirmed business model (from the owner directly):** FoodTaxi's Stripe
account only ever charges *subscribing businesses* their own fee to use the
platform. It never touches a food customer's payment for their fish and
chips — that stays entirely between the business and its own customer
(cash, their own card machine).

FoodTaxi has **three separate, deliberately unconnected** Stripe concepts —
see §13 for the full Phase B writeup of the first row below.

| Flow | File | Status |
|---|---|---|
| **FoodTaxi Business subscription** (£19.99/mo, 3-day trial, FoodTaxi's own Checkout + Customer Portal) | `app/api/subscriptions/checkout`, `/portal`, `/route.ts` (legacy, unused) | ✅ **Active (Phase B)** |
| Event booking fee (£29.99, one-off, FoodTaxi's own Checkout) | `app/api/events/pay/route.ts` | ✅ Active — unchanged by Phase B |
| Webhook | `app/api/webhooks/stripe/route.ts` | ✅ Active for booking fee + subscription lifecycle events, idempotent (`stripe_webhook_events`) |
| Stripe Connect (marketplace) | `app/api/payments/create-intent/route.ts` | ⚠️ Inactive, unused, and contradicts the confirmed model above. Not touched in Phase B — deletion decision is for later. |
| Legacy multi-tier subscription route | `app/api/subscriptions/route.ts` | ⚪ Superseded by `app/api/subscriptions/checkout` in Phase B. Left in place, not deleted, not called by any UI. |

---

## 6. Active features

Multi-business/multi-van management · online ordering with live-pickup
fallback for unscheduled days · WhatsApp AI ordering with delivery-status
tracking · till/POS with offline sale queueing · kitchen display · live GPS
tracking · customer check-in · weekly schedules (AI-parseable) · menu
management with AI photo scan and mix-and-match deals · hygiene/HACCP
logging · events/catering marketplace with real Stripe Checkout · email
marketing with unsubscribe compliance · QR codes · AI-driven business
discovery and lead outreach · super admin back office.

## 7. Partial / inactive features

Real subscription billing, card payment at the till, staff roles
(schema exists, unused), reviews (schema + RLS exist, no UI), Stripe Connect
(dead code), push notifications (`notifications` table exists, nothing
writes to it), `audit_logs` (table + RLS exist, nothing writes to it — see
below), `customer_favourite_vans` (no UI).

## 8. Known technical debt

- Dead frontend components (`components/menu/MenuBuilder.tsx`,
  `components/menu/MenuItemForm.tsx`) target the legacy relational menu
  schema and are imported nowhere. Not deleted in Phase A.
- `subscription_plans` seeded with Starter/Pro/Enterprise pricing that was
  never connected to real Stripe prices — will need re-deciding, not just
  re-connecting, once real pricing (per the owner's decision) is set.
- No PWA/service worker/push notification infrastructure despite the
  `notifications` table existing.

## 9. Recommended `audit_logs` structure (documented only — not built in Phase A)

The table already has the right shape (`actor_id`, `action`, `entity_type`,
`entity_id`, `old_values`, `new_values`, `created_at`) and RLS
(`super_admin` read, any authenticated insert). It is currently unused by
any code. A safe, small Phase B starting point — **not built now** — would
be a single helper (`logAdminAction(supabase, { actor, action, entityType,
entityId, metadata })`) called only from the highest-risk super-admin
actions first: order deletion, user password reset/creation
(`/api/admin/fix-user`), and WhatsApp channel changes. A full audit
subsystem (covering every write) is explicitly out of scope until asked for.

## 10. Security notes (Phase A review)

**Fixed in Phase A:**
- **Critical:** `/api/admin/fix-user` had *no authorization check at all*
  despite a comment claiming it was admin-only — any unauthenticated caller
  could reset any account's password (to an attacker-chosen or hardcoded
  default), force-confirm any email, create a new account with any role
  including `super_admin`, and re-link a business's ownership. Now requires
  a verified super admin, same as every other admin endpoint.
- Super-admin authorization centralised into `lib/isSuperAdmin.ts` and
  applied consistently, including the actual `/admin/*` boundary
  (`middleware.ts`), closing the gap where some routes checked email only
  and others checked email-or-role inconsistently.
- `event_requests` / `event_applications` / `event_blocked_dates` had RLS
  disabled entirely (no policy ever defined) — now enabled with
  super-admin-only policies, matching how the app actually accesses them
  (exclusively via the service-role key server-side; confirmed no
  browser/anon-key usage exists anywhere in the codebase).

**Not changed, needs a human decision (see §11):**
- The super-admin check still has an email-based fallback until the real
  account's `users.role` is confirmed as `'super_admin'` in the live
  database — this was a deliberate, safe choice (never risks lockout) but
  is an interim state, not the end state.

**Reviewed, no issue found:**
- RLS policies across menu, orders, hygiene, WhatsApp, marketing tables are
  consistently scoped to `my_van_ids()`/`my_business_ids()`.
- Public/guest endpoints (guest order insert, order-status/checkin,
  receipt, unsubscribe) correctly rely on unguessable UUIDs as the
  credential, with no privilege escalation path found.
- WhatsApp webhook verifies Meta's `hub.verify_token` on the GET challenge.
- Stripe webhook verifies `stripe-signature` before processing any event.

**Not addressed (flagged for a future decision, not fixed speculatively):**
- No rate limiting on public write endpoints (guest orders, unsubscribe,
  WhatsApp webhook). Low risk at current scale; worth revisiting before a
  wider marketing push.

## 11. Action required from you

1. **Run this in Supabase SQL Editor** to check your own account's DB role:
   ```sql
   select u.email, u.role
   from users u
   join auth.users au on au.id = u.auth_id
   where au.email = 'sivakuna@icloud.com';
   ```
   If `role` is not `super_admin`, tell me and I'll give you the exact
   (safe, non-destructive) `UPDATE` to fix it. Once confirmed, the email
   fallback in `lib/isSuperAdmin.ts` can be removed in a future phase.
2. **Run migration `20240048_schema_reconciliation.sql`** in Supabase SQL
   Editor (full text below in the completion report).

## 12. Deployment

Vercel, deployed from this repo. Environment variables per
`.env.example` (reorganised in Phase A with explicit FOODTAXI / AGENT
PLATFORM / YOUTUBE sections). No deployment configuration was changed in
Phase A.

---

## 13. FoodTaxi Business subscription (Phase B)

**One plan, no tiers:** FoodTaxi Business, £19.99/month GBP, first 3 days
free. There is no Starter/Pro/Enterprise — the three plans seeded in
`20240001_initial_schema.sql` are deactivated (`is_active = false`), not
deleted, by `20240049_foodtaxi_business_subscription.sql`.

**Config:** `lib/subscriptionConfig.ts` — plan name, £19.99 display price,
3-day trial length, and `STRIPE_FOODTAXI_MONTHLY_PRICE_ID` (env var, never
hard-coded). The Stripe Price itself must be created once in the Stripe
Dashboard — see §14.

**Access control:** `lib/subscriptionAccess.ts` — `hasActiveFoodTaxiAccess(supabase, businessId)`
and `computeHasAccess(subscription)` are the single source of truth for
whether a business's dashboard access is live. Access = `status` in
(`trialing`, `active`) OR `subscriptions.grandfathered = true`. No other
file should compare `subscription.status` directly.

**Enforcement point:** `lib/supabase/middleware.ts`, the same real security
boundary established in Phase A for `/admin/*`. It now also gates
`/dashboard/*` (except `/dashboard/billing`, to avoid a redirect loop, and
except super admins). An expired/inactive business is redirected to
`/dashboard/billing?expired=1`, which shows a reactivate flow — their
business, vans, menu, orders and history are never touched. Customer-facing
routes (`/van/[slug]`, `/order/[id]`, `/order-status/*`, `/receipt/*`,
`/pos-display/*`) are outside `/dashboard` entirely and are never affected.

**Checkout:** `app/api/subscriptions/checkout/route.ts` — Stripe Checkout,
`mode: 'subscription'`, `trial_period_days: 3` (only for a business that has
never had a Stripe subscription id before, so cancel-and-resubscribe never
grants a second free trial). `business_id` is always derived server-side
from the authenticated user's own business row — never trusted from the
request body.

**Management:** `app/api/subscriptions/portal/route.ts` — Stripe Customer
Portal session (update card, view invoices, cancel). FoodTaxi does not
reimplement any of this UI itself.

**Webhooks:** `app/api/webhooks/stripe/route.ts` now also handles
`customer.subscription.created/updated/deleted` and
`invoice.payment_failed`, matched by Stripe customer id (set on the
`subscriptions` row before Checkout ever opens, so it works regardless of
event delivery order). Every event id is recorded in `stripe_webhook_events`
before processing — a Stripe redelivery is detected and skipped, so
subscriptions can never be double-processed.

**Existing-business protection (Phase B11):** every `subscriptions` row that
existed before this migration first ran was marked `grandfathered = true` —
a blanket, reversible flag, not a per-business judgement call. A
grandfathered business always has access regardless of `status` or
`trial_ends_at`, until the flag is turned off or the business actually
subscribes through Stripe Checkout. This is why the live Howe & Co account
was not put at risk by Phase B shipping.

**Onboarding (Phase B9/B10):** the existing registration flow
(`/register/business` → `POST /api/businesses`) is unchanged in shape — it
now starts a real 3-day trial (was a dormant 14-day placeholder) against the
single FoodTaxi Business plan. `app/(business)/dashboard/page.tsx` shows a
checklist (business created / subscription started / first van / menu /
weekly schedule) whenever any step is incomplete, computed from data that
already exists — no new onboarding tables or wizard route.

**Analytics (Phase B12–B17):** `app/api/analytics/summary/route.ts` +
`/dashboard/analytics`. Server-side aggregation (Phase B16) over a bounded
30-day order window, plus separate Today/This Week/This Month summaries.
**Revenue definition:** sum of `orders.total` excluding only
`status = 'cancelled'` — the exact rule the dashboard already used
pre-Phase-B for "Today's Sales", extended rather than redefined. All
channels (online/guest/POS/WhatsApp) and payment methods count.
Multi-van filtering re-uses `my_van_ids()`/business ownership, never trusts
a client-supplied van id without checking it belongs to the caller's
business.

**Route/stop analytics — not built (Phase B15):** `orders` has no reliable
link to a specific `van_schedule` stop. The original schema's
`orders.stop_id → route_stops` is dead (superseded by `van_schedule`, which
`orders` was never updated to reference), and the free-text
`orders.pickup_location` can't be safely joined back to
`van_schedule.location_name` (wording/typos). Building this would need a
new nullable `orders.schedule_stop_id → van_schedule(id)` column, set at
order time for orders placed against a scheduled stop, and only from then
on would stop-level revenue be reliable — not retrofittable onto historical
orders. Not built; flagged for a future phase.

## 14. Manual setup required for Phase B

1. **Create the Stripe Price** — Stripe Dashboard → Product catalog → new
   Product "FoodTaxi Business", recurring price £19.99 GBP/month. Copy the
   resulting `price_...` id into `STRIPE_FOODTAXI_MONTHLY_PRICE_ID` in
   Vercel's environment variables.
2. **Enable the Stripe Customer Portal** (test mode and live mode
   separately) — Stripe Dashboard → Settings → Billing → Customer portal —
   turn it on and configure what a customer may do (cancel, update payment
   method). `app/api/subscriptions/portal/route.ts` will fail until this is
   turned on.
3. **Run `20240049_foodtaxi_business_subscription.sql`** in Supabase SQL
   Editor (together with the still-outstanding `20240048` from Phase A —
   see §11 — if that hasn't been run yet).
4. Confirm `STRIPE_WEBHOOK_SECRET` in Vercel matches the same endpoint
   Stripe is sending `customer.subscription.*` and `invoice.payment_failed`
   events to (it already receives `checkout.session.completed` for the
   £29.99 event flow, so this is normally just confirming the event types
   are enabled on that same endpoint in the Stripe Dashboard).
