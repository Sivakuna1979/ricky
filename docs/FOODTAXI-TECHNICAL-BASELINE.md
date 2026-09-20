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

---

## 15. Business Operations (Phase C)

**Same subscription, no add-ons.** All of §16–§24 below are covered by the
one £19.99/month FoodTaxi Business subscription — nothing here is gated by
a separate plan or add-on.

### 16. Stock architecture

`stock_items` (catalogue, no hard-coded products) → `stock_locations`
(warehouse/van/other) → `stock_levels` (quantity **per location** — this is
why a transfer or a per-van "low stock" view is possible at all).
`stock_movements` is an append-only ledger; the only thing that ever
changes `stock_levels` is `apply_stock_movement()`, a `SECURITY DEFINER`
Postgres function that row-locks the level, records
`previous_quantity`/`new_quantity`, and inserts the movement row —
atomically, so two concurrent writes (two staff recording wastage at once,
a retried webhook) can never lose an update. `REVOKE`d from `authenticated`/
`anon` — only callable from server routes using the service-role client,
after that route has already checked the caller's permission.

### 17. Stock movement rules

Movement types: `PURCHASE`, `TRANSFER_IN`, `TRANSFER_OUT`, `SALE`,
`WASTAGE`, `ADJUSTMENT`, `RETURN`. A transfer is always a linked
`TRANSFER_OUT`/`TRANSFER_IN` pair sharing a `reference_id` — never a single
row that silently moves quantity. Every write is auditable via
`stock_movements` (business-scoped, read-only for owners/staff via RLS).

### 18. Automatic stock deduction (`lib/stockDeduction.ts`)

**Deduction point: order status → `collected`**, via the single existing
`PATCH /api/orders/[id]/status` route every channel (online, POS, WhatsApp)
already goes through — not order creation (could be cancelled before
anything leaves the van) and not payment (POS cash sales have no separate
payment event). Entirely optional per business: no `menu_stock_components`
rows for a menu item, or no `stock_locations` row for that van, means
nothing happens — it must never block fulfilling an order.

**Idempotency:** `orders.stock_deducted_at` / `stock_restored_at` are
compare-and-set guards enforced by the `UPDATE ... WHERE ... IS NULL`
clause at the database level (not an application-level check-then-act,
which would have a race window). A retried webhook, a repeated offline-POS
sync, or the same status transition firing twice all no-op safely.

**Restoration policy:** cancelling an order after its stock was deducted
creates a `RETURN` movement that puts back exactly what was taken —
guarded the same way, so a second cancel or a cancel that never actually
deducted anything is also a safe no-op.

### 19. Wastage

`wastage_records` (reason/quantity/cost/location/staff/notes) + an
automatic `WASTAGE` movement. Today/week/month totals are computed
server-side in `GET /api/wastage`.

### 20. Suppliers & purchase orders

`supplier_records` (existed since the initial schema, confirmed unused by
any code before Phase C) is the real supplier directory now — extended
with `website`/`account_reference`/`is_active`, not duplicated into a new
table. `supplier_products` links a supplier to a `stock_item` with cost/
pack-size/preferred. `purchase_orders` states: `DRAFT → ORDERED →
PARTIALLY_RECEIVED/RECEIVED`, or `CANCELLED` (enforced server-side, not
just in the UI). Receiving a delivery (`POST
/api/purchase-orders/[id]/receive`) increases stock via
`apply_stock_movement()` (`PURCHASE`) and updates
`supplier_products.latest_cost`. Does **not** auto-create a hygiene
delivery-check record — those stay a separate, unrelated workflow; nothing
is duplicated between them.

### 21. Staff & permissions

**Reused, not rebuilt:** the `staff` table has existed since the initial
schema and was already UNIONed into `my_van_ids()` — Phase C activates it
rather than building a parallel system. Its old
`UNIQUE(business_id, user_id)` constraint (safe to drop — nothing had ever
written to the table) is gone, so one person can have several `staff` rows,
one per assigned van; a single row with `van_id = NULL` means "all vans",
which `my_van_ids()` was extended to understand (purely additive — every
case it granted before, it still grants identically).

**Roles:** `OWNER` (implicit — `businesses.owner_id`, never a `staff` row,
always has every permission), `BUSINESS_ADMIN`, `VAN_MANAGER`, `DRIVER`,
`STAFF`. `SUPER_ADMIN` stays platform-level and entirely separate (handled
by `lib/isSuperAdmin.ts`, untouched by any of this).

**Central permissions architecture:** `lib/permissions.ts` (the
role → permission map, one place, not scattered `if (role === ...)` checks)
+ `lib/staffContext.ts` (`getStaffContext()` resolves who the caller is —
owner or which `staff` role/vans — from their session, never from a
client-supplied `business_id`). Every Phase C write route calls
`hasPermission(ctx.role, '...')` before writing.

**RLS vs API split (deliberate, documented):** every new table's RLS
policy is a coarse tenant boundary (`my_business_ids()` OR
`my_staff_business_ids()` OR `is_super_admin()`) — any active staff role
can *see* these rows. *Which* actions a role may *take* is enforced in the
API layer, not by per-role RLS policies (that would mean 15+ tables × 5
roles of policies for no real safety gain, since the API layer already
gates every write). This mirrors how `/admin/*` routes already work.
**Known simplification:** RLS visibility is business-wide, not narrowed to
a van-restricted staff member's assigned vans, for the new operational
tables (shifts, vehicles, etc.) — e.g. a driver assigned to one van can
still *see* another van's shift list, though they can't *act* on business
functions their role lacks permission for. Not a tenant-isolation gap
(never crosses businesses); a candidate for tightening later.

**Invitations (`app/api/staff/route.ts`):** uses Supabase Auth's own
`inviteUserByEmail` — an unconfirmed auth user is created and emailed a
secure link to set their own password. No shared or hardcoded password is
ever created (unlike `/api/admin/fix-user`'s default-password pattern,
deliberately not reused here). `staff.joined_at` is set on the invited
person's first successful login (hooked into the existing
`/api/auth/profile` auto-provision flow).

**Subscription gate now covers staff too:** the Phase B middleware gate
originally only checked the *owner's* business. Phase C extended it —
`middleware.ts` now also resolves a staff account's employer business and
gates on that business's subscription, since Phase C features are covered
by the same subscription (§31 in the original brief). A staff account
whose employer's subscription has lapsed sees a read-only message on
`/dashboard/billing` ("contact your business owner") rather than the
owner's Start/Manage actions.

### 22. Shifts & timesheets

`shifts` (scheduled) and `time_entries` (actual clock-in/out) are separate
— a shift is a plan, a time entry is what happened. Clock in/out is
available to any active staff account for their own time (not
permission-gated — it's their own attendance, not a management action).
Manual corrections (`PATCH /api/time-entries/[id]`) require
`manage_shifts` and are audit-logged with the reason.

### 23. Vehicles & equipment

`vehicle_details` is a **1:1 extension of `vans`** (`van_id` is its primary
key) — it does not duplicate `vans.registration_plate` or create a second
vehicle identity. `vehicle_maintenance` and `equipment_maintenance` both
update their parent's `next_service_date` when a maintenance entry sets
one, so the reminder engine stays current.

**`vehicle_documents` is metadata-only** (document type + expiry date +
optional external `file_url`) — there is no Supabase Storage
bucket/upload architecture anywhere in FoodTaxi yet (confirmed: zero
`.storage.from(` calls in `apps/web` before or after Phase C), and building
one from scratch, safely, with correct private-bucket access rules, is
exactly the kind of unreviewed security surface this phase should not
introduce casually. The reminder engine (§24) doesn't need the file — only
the expiry date. Real upload is real Phase D/E work, once a Storage
convention exists (ideally also retrofitted to `hygiene_documents`, which
has the same gap).

### 24. Reminders & operations dashboard

Reminder logic lives in `GET /api/operations/summary` (30-day window,
configurable via `REMINDER_WINDOW_DAYS` in that file) — MOT/insurance/road
tax/service-due dates within the window, or already passed. The operations
dashboard **extends** the existing main `/dashboard` page (a new
"Operations" card above the existing stats — see `components/operations/
OperationsSummary.tsx`) rather than replacing it, per the Phase C brief.
Hygiene "outstanding" reuses the existing `hygiene_logs` opening-checklist
data (a live van with no `opening_checklist` row logged today counts as
outstanding) — no new hygiene tracking was built.

### 25. Audit trail

`audit_logs` existed since the initial schema and was documented as a
Phase A recommendation but never written to. `lib/auditLog.ts` is the
first real writer, called from: stock adjustments, stocktake confirmation,
purchase-order status changes, staff role changes, timesheet corrections,
vehicle detail changes. Deliberately not wired into read paths or routine
CRUD that doesn't need an audit trail.

### 26. Not built in Phase C (see the completion report for the full list)

- Camera-based barcode scanning — `stock_items.barcode` exists and a
  manual barcode-entry lookup is the supported path today; a maintained
  scanning library was not integrated (Phase C's own instructions
  explicitly allow this — "create the architecture and manual
  barcode-entry fallback").
- Vehicle/hygiene document file upload (see §23).
- A dedicated recipe-editing screen inside the Menu page —
  `menu_stock_components` and its API
  (`app/api/menu/stock-components/route.ts`) are fully functional, but
  there is no UI wired into `/dashboard/menu` yet to use them.

---

## 27. Automation & Smart Operations (Phase D)

**Same subscription.** Every automation in this section is included in the
one £19.99/month FoodTaxi Business subscription — no automation/AI/premium
tier was created.

### 28. Automation engine (D1–D4)

`lib/automations/engine.ts` is the one shared engine every automation runs
through — a "trigger → conditions → action → result" evaluator function,
not one-off scattered code. Two functions carry the whole design:

- **`claimRun(admin, businessId, automationType, triggerKey)`** — attempts
  to INSERT the `automation_runs` row for that exact `triggerKey` first. A
  fresh key succeeds and the evaluator proceeds; a key that already
  succeeded (or is mid-run, or was skipped) returns `null` and the
  evaluator does nothing further. **This is the entire idempotency
  guarantee (D4)** — enforced by `automation_runs`'s
  `UNIQUE(business_id, trigger_key)` constraint at the database level, not
  by an application-level "check, then act" (which would have a race
  window under a retried cron tick or an overlapping invocation). A key
  whose only previous attempt `FAILED` *can* be reclaimed — this is what
  makes retries and next-tick self-healing possible without permanently
  wedging a trigger_key that failed once.
- **`notify(admin, params)`** — writes the in-app notification (always, if
  that automation's `in_app` channel is on) and only fans out to
  email/SMS if the business explicitly enabled those channels for that
  specific automation type (D7) — nothing external is ever sent by
  default.

`trigger_key` is a deterministic, human-readable string per event, e.g.
`low_stock:{stock_item_id}:2026-09-20` or
`vehicle_reminder:{van_id}:mot_expiry:14:2026-09-20`. Including the
business-local date is what makes a scheduled check run "once per day"
rather than once per cron tick.

### 29. Data model (D2)

- **`automation_settings`** (business_id, automation_type, enabled,
  channels jsonb, config jsonb) — one row per business per automation
  type, created lazily the first time a business changes a setting.
  Doubles as both "on/off" (D26) and configuration/channels (D27) rather
  than two overlapping tables. A business with no row for a given type
  gets that type's coded default (`lib/automations/types.ts`) — so adding
  a new automation type later needs no backfill.
- **`automation_runs`** — the execution log (D3) and the idempotency
  mechanism (D4), described above.
- **In-app notifications reuse the existing `notifications` table
  as-is** (user_id-scoped, existed since `20240001`, RLS already correct)
  — category/priority/action_url/business_id live in its existing `data`
  jsonb column, so no columns were added to it.
- `businesses.timezone` (new column, defaults `'Europe/London'` for every
  existing business) drives all scheduling (D28).

### 30. Scheduling (D29)

**Vercel Cron**, not Supabase pg_cron and not the unrelated `apps/youtube`
BullMQ worker — this is a Next.js app already on Vercel, Vercel Cron needs
no new infrastructure, and there is no existing FoodTaxi job-queue process
to extend (BullMQ is youtube-automation's own worker, a separate
deployment target; copying it in for FoodTaxi alone would add real
infrastructure for no benefit at this scale). `vercel.json` now has one
cron: `GET /api/cron/automations`, hourly (`0 * * * *`).

**Authorization:** the route checks `Authorization: Bearer <CRON_SECRET>`
— named exactly `CRON_SECRET` (not a FoodTaxi-specific name) because
that's the one env var name Vercel Cron automatically signs its own
requests with. `apps/web` is a separate Vercel project from `apps/agent`,
so this doesn't collide with `apps/agent`'s own unrelated `CRON_SECRET`.

**Resolution vs frequency:** the cron tick is hourly, but each automation
decides for itself whether it's actually due, via
`isDueNow(timezone, hour, minute)` (§31) — so a business's 8:00am daily
briefing fires within the same hour it's configured for, in *their*
timezone, without needing a job scheduled at the exact minute. This keeps
the design D40-compliant (not scanning everything every minute) while
staying accurate per business.

**Known constraint to check:** Vercel's Hobby plan only runs cron jobs
once per day, regardless of the schedule expression — see §33 manual
actions. Correctness is unaffected either way (idempotency doesn't care
how often the tick fires), only timeliness/resolution is coarser on
Hobby.

### 31. Timezone handling (D28)

`lib/automations/timezone.ts` computes "business-local now" via
`Intl.DateTimeFormat` with the business's own `timezone` column — no
external dependency, no assuming UTC. `isDueNow()`, `todayDateInTimezone()`
and `isoWeekKey()` are all timezone-aware, so "today" for a report or a
trigger_key's date bucket matches the business's own calendar day, not
UTC's. (Note: this is more correct than Phase B/C's analytics, which use
server/UTC date boundaries — a known, documented pre-existing limitation
there, not touched or regressed by Phase D.)

### 32. Notification centre (D5, D6)

`/dashboard/notifications` (`components/notifications/NotificationCentre.tsx`)
— filter by category (stock/hygiene/vehicle/staff/reports/marketing/events),
mark one or all read, open the linked record via `action_url`. Priorities
(`INFO`/`ACTION`/`IMPORTANT`/`CRITICAL`) are set per-automation in
`lib/automations/types.ts`, not assigned ad hoc — most automations are
`ACTION` or `INFO`; only genuinely urgent ones (out-of-stock, overdue
vehicle renewals) are `IMPORTANT`. Nothing is `CRITICAL` yet.

### 33. Notification preferences & channels (D7)

Per automation type: `in_app` (default on), `email`, `sms` (both default
off except vehicle reminders and the weekly summary, which default to
`in_app + email`), and `whatsapp` (present in the data model and the
control-centre UI for completeness, **but not implemented for delivery**
— see below). Channel senders (`lib/notify/channels.ts`) mirror the exact
providers/env vars already used elsewhere in FoodTaxi (Resend for email,
Twilio for SMS) but are implemented fresh rather than importing the
existing inline functions from `app/api/marketing/send` and
`app/api/orders/manage` — so Phase D cannot accidentally change behaviour
in those already-working, customer-facing flows.

**WhatsApp automation delivery — not built.** Sending an owner a
business-alert WhatsApp message would need either an open 24-hour
conversation window or an approved message template, neither of which
exists for this purpose. Documented, not faked.

### 34. Stock automation (D8, D9, D10)

`lib/automations/evaluators/stock.ts`, once per business per day:
- **Low stock / out of stock**: `current_quantity <= minimum_quantity`
  (low) or `<= 0` (out), summed across all a business's stock locations
  (same total Phase C's stock page already shows).
- **Reorder suggestion**: deterministic only — if `reorder_quantity` is
  configured on the item, it's shown in the alert with the reason
  ("based on your configured reorder quantity"). No sales-velocity
  prediction is calculated in Phase D (would need materially more
  historical-consumption logic to do honestly); not labelled "AI" because
  none is used.
- **Draft PO automation (D10)** — off by default. When enabled, groups
  currently low/out items by their configured preferred supplier and
  creates one `DRAFT` (never `ORDERED`) purchase order per supplier per
  day — the owner reviews and confirms it themselves via the existing
  Suppliers page (Phase C). Never places a real order automatically.

### 35. Hygiene automation (D11, D12)

`lib/automations/evaluators/hygiene.ts` reads the existing `hygiene_logs`
table (`opening_checklist`/`closing_checklist` log types, already written
by `/dashboard/hygiene`) — never creates, completes, or fabricates a
check. Alerts only after a business-local deadline has passed (11:00 for
opening, 21:00 for closing — documented, fixed defaults for now, not yet
business-configurable) and only once per van per checklist per day.

### 36. Vehicle & equipment reminders (D13, D14)

`lib/automations/evaluators/vehicle.ts`. Thresholds: 30/14/7/1 days before,
plus overdue. **Exact-day matching** (a date is only ever exactly 14 days
away once) is what prevents duplicate reminders across multiple days for
the same renewal — not a dedup table, just correct arithmetic plus the
trigger_key's date bucket.

### 37. Staff/shift automation (D15)

`lib/automations/evaluators/staff.ts`, with documented, deliberately
conservative grace periods (not configurable yet):
- **Unassigned shift** — tomorrow's van has a `van_schedule` entry (i.e.
  it's expected to operate) but no `shifts` row.
- **Late clock-in** — a shift's start time + **15 minutes** has passed
  with no matching `time_entries` row today.
- **Missing clock-out** — clocked in for more than **12 hours** with no
  clock-out. (A precise "shift end + N hours" match was considered but
  needs reliable shift↔time-entry linkage that doesn't exist cleanly yet;
  the 12-hour heuristic catches genuine forgotten clock-outs without
  false-alarming on legitimately long shifts.)

### 38. Reports (D16, D17, D18)

`lib/automations/evaluators/reports.ts`. All three use the **same revenue
definition already established in Phase B's analytics** (sum of
`orders.total` excluding only `status = 'cancelled'`) — never redefined.

- **Daily briefing** (default 08:00 business-local, in-app only by
  default): vans scheduled today (`van_schedule` for today's weekday),
  staff working today (`shifts`), low-stock count, hygiene checks still
  due, vehicle reminders due within 30 days, event enquiries awaiting
  response. No sales/revenue figures — deliberately, per the brief
  ("do not invent expected sales").
- **End-of-day summary** (default 21:00, off by default): real revenue,
  orders, average order value, top sellers, wastage cost, staff hours —
  every figure from a real query.
- **Weekly summary** (default Monday 08:00, off by default, in-app +
  email): this week vs previous week revenue (a plain subtraction/
  percentage, not a forecast), best-performing van, wastage, staff hours,
  low-stock count, purchase orders awaiting delivery.

### 39. Marketing suggestions (D22, D23)

`lib/automations/evaluators/marketing.ts` — off by default, weekly. Finds
customers (by `orders.guest_email`, since FoodTaxi has no logged-in
customer accounts) who ordered from a van in the last 60 days but not the
last 21 — a plain set-difference, not an AI segmentation. Only ever
**suggests** ("N customers... suggested action: create a campaign") and
links to the existing `/dashboard/marketing` page; nothing is sent
automatically, and when it is sent manually, the existing
unsubscribe/consent checks in `app/api/marketing/send` still apply
unchanged.

### 40. Event automation (D24, D25)

`lib/automations/evaluators/events.ts` — **event_tomorrow only**. A
day-before reminder for a business's own confirmed application, using
only real fields (`event_location`, `event_type`, `num_guests`,
`food_type`, `notes`). Does not touch `app/api/events/pay` or the £29.99
booking fee flow at all.

**"New event enquiry" (D24) — not built as a per-business automation.**
`event_requests` has no `business_id` (it's a cross-business marketplace
table — a customer enquiry is published by the super admin and applied to
by multiple vans; see `20240048_schema_reconciliation.sql`), so there is
no single business to notify about a *brand-new* enquiry. That stays a
super-admin/`/admin/events` concern, unchanged.

**Event meal-quantity preparation summary (D25) — not built.**
`event_requests` has no structured per-item quantity data, only free-text
`food_type`/`notes`. Building the "Cod & Chips: 80" style breakdown the
brief shows as an example would mean inventing numbers that don't exist in
the schema — explicitly forbidden by the brief itself. Flagged as a
schema gap for a future phase, not silently worked around.

**Architecture note:** unlike every other evaluator (called once per
business from the cron loop), `runEventTomorrowReminders()` scans
tomorrow's confirmed applications globally, resolves each to a business by
matching `van_owner_email` against `businesses.email`, and only then
checks *that* business's own `automation_settings` before notifying —
tenant isolation is still preserved (a notification only ever reaches the
one business it resolves to), it's just discovered differently because
the underlying data isn't business-scoped to begin with.

### 41. Automated customer communication (D19, D20, D21) — reviewed, mostly not extended

- **D19**: the existing order-ready SMS (`app/api/orders/manage`,
  Twilio) was reviewed and left untouched — it already covers the main
  "tell the customer something changed" case. New customer-facing
  lifecycle messages (order-accepted, collection-reminder) were **not**
  added in Phase D: the brief explicitly protects customer-facing order
  flow from unnecessary changes, and adding new trigger points there is
  real additional scope with real spam risk — recommended for a future
  phase if wanted, not built speculatively here.
- **D20 (van arrival notifications) — documented, not built.** There is no
  existing mechanism for a customer to opt into "notify me for this stop"
  (orders carry a one-time `guest_phone`, not an ongoing subscription) —
  building one is a real new customer-facing feature, not an automation on
  top of something that exists. Foundation: `live_locations` (GPS pings)
  and `van_schedule` (stop times) both exist; what's missing is the
  opt-in mechanism and per-stop coordinates (`van_schedule` only has a
  location *name*, not lat/lng).
- **D21 (route delay foundation) — documented, not built.** Detecting
  "running late" reliably needs a current-stop's coordinates to compare
  against `live_locations`, which `van_schedule` doesn't have (text
  location names only). A clock-only signal ("scheduled arrival time has
  passed") was considered but without stop coordinates there's no way to
  know if the van is late for *that* stop or already fine at the next
  one — not built rather than shipping something that could be
  confidently wrong. The brief explicitly permits documentation-only here
  when reliable data doesn't exist yet.

### 42. Automation control centre (D26, D27, D36)

`/dashboard/automations` (`components/automations/AutomationsCentre.tsx`)
— three tabs: **Settings** (every automation grouped by category, on/off
toggle, per-channel toggles when enabled), **Recent Runs**, **Failed**
(with a Retry button — see §43). Reading settings is available to any
active staff role; *changing* them requires `manage_business`
(owner/business_admin only — an ordinary staff account cannot change
automation or billing settings, per D36). No cron/job implementation
detail is exposed — just what's on, what ran, and what failed.

### 43. Retries & failure visibility (D30, D31)

A `FAILED` run can be retried from the control centre. Retrying
re-invokes that automation family for the same business —
`claimRun()`'s reclaim-only-if-`FAILED` behaviour (§28) means this can
only re-attempt the specific thing that failed, never re-send something
that already succeeded. **Known limitation:** the three report
automations (daily briefing / end-of-day / weekly summary) gate on
`isDueNow()` before calling `claimRun()` at all — a manual retry outside
their configured time window will currently no-op rather than force-run
immediately. Stock/hygiene/vehicle/staff retries are not affected by this
and work immediately. Documented rather than silently broken.

### 44. Audit logging (D38)

`lib/auditLog.ts` (Phase C) now also logs: automation settings changed,
and (via the existing purchase-order/staff-role-change audit points)
anything a draft-PO automation or similar touches downstream. Draft PO
creation itself is visible via `automation_runs.result` rather than a
duplicate audit_logs entry, to avoid double-logging the same event in two
places.

### 45. Security & tenant isolation (D35)

Every evaluator is called once per business, scoped to that
`business_id` throughout every query — the one exception
(`event_tomorrow`, §40) resolves and scopes to a single business *before*
calling `notify()`, so no cross-business leak is possible there either.
The cron route itself loops businesses one at a time and wraps each in its
own try/catch, so one business's failure or bug can never block or affect
another's automations (D35's "never bypass tenant isolation carelessly
simply because a service-role job is running" — every query still filters
by the specific business being processed, service role or not).

### 46. Not built in Phase D (see the completion report for the full list)

- WhatsApp channel delivery for automation alerts (§33)
- New customer-facing order-lifecycle messages beyond the existing
  order-ready SMS (§41)
- Van arrival notifications / route delay detection (§41) — documented
  foundations only, as the brief explicitly permits
- Event meal-quantity preparation summaries (§40) — no structured data to
  report
- Business-configurable hygiene deadline times / staff grace periods
  (currently fixed, documented defaults)
- Immediate force-retry for the three report automations outside their
  scheduled window (§43)

---

## 47. FoodTaxi AI (Phase E)

**Same subscription.** FoodTaxi AI is included in the one £19.99/month
subscription — no AI tier, credits package, or premium plan was created.
It is a **business** feature — nothing about it is reachable from any
customer-facing route.

### 48. Architecture (E4)

```
Authenticated user (owner/staff)
        ↓
POST /api/ai/chat
        ↓
lib/ai/context.ts — resolveAiContext()
   (built on the SAME lib/staffContext.ts every Phase C/D route uses —
    business_id/role/van scope are never taken from the request)
        ↓
lib/ai/assistant.ts — Claude tool-use loop
        ↓
lib/ai/tools/*.ts — ~19 approved read tools + 1 write-proposal tool,
   each scoped to ctx.businessId (and ctx.vanIds for van-restricted staff)
        ↓
Structured, aggregated query results (never raw table dumps)
        ↓
Claude explains the results in natural language
        ↓
[optional] a write proposal → ai_pending_actions (PENDING)
        ↓
User presses Confirm in the UI → POST /api/ai/actions/[id]/confirm
   (a plain authenticated request, never something the model can trigger)
        ↓
FoodTaxi executes exactly once
```

**Deliberately separate from the WhatsApp ordering AI (E4, E38).**
`app/api/ai/parse-whatsapp-order` and `app/api/webhooks/whatsapp` (customer
ordering) were not touched, share no prompt, no tool layer, and no code
path with `lib/ai/*`. The only thing genuinely shared is the `Anthropic`
SDK client pattern itself (same fallback convention — see §50) — there is
no possibility of a customer WhatsApp conversation reaching a business
tool, because the WhatsApp webhook never imports anything from `lib/ai/`.

### 49. No raw database access (E6)

Claude is never given Supabase credentials, a SQL tool, or unrestricted
query capability. It receives only the ~20 named tools in
`lib/ai/tools/index.ts` — each with a fixed JSON Schema Claude must supply
arguments against, and each handler independently re-scopes every query to
`ctx.businessId` (and van access for restricted roles) regardless of what
the model asked for. There is no code path from a chat message to a raw
`SELECT`.

### 50. Claude integration & model configuration (E34)

`lib/ai/assistant.ts`. Uses `@anthropic-ai/sdk` (already a FoodTaxi
dependency). Model names are environment-configured, not hard-coded:
`ANTHROPIC_FOODTAXI_MODEL` (default `claude-fable-5`) with
`ANTHROPIC_FOODTAXI_FALLBACK_MODEL` (default `claude-opus-4-8`) — same
try-the-beta-then-fall-back-to-a-plain-call pattern already used in
`app/api/ai/parse-whatsapp-order`, reimplemented fresh here (not imported)
so Phase E can't affect that route's behaviour. Tool-use loop is bounded
to 5 rounds (`MAX_TOOL_ROUNDS`) — a question that would need more steps
gets a plain "please narrow this down" reply rather than looping
indefinitely (cost control, E33).

### 51. Business/tenant isolation & role awareness (E2, E3)

Every tool handler receives the server-resolved `AiContext`
(`businessId`, `role`, `vanIds`) and is responsible for scoping its own
queries to it — there is no tool that accepts a business id as an
argument at all, so there is nothing for a prompt-injected or malicious
message to override (E2's example attack — "show me Business 123's
revenue" — has no mechanism to act on even in principle, because no tool
schema has a field for it). Van-restricted roles (driver/staff assigned
to specific vans, not "all vans") are enforced via
`assertVanAllowed()`/`allowedVanIds()` in `lib/ai/context.ts`, built on
the exact same `staff.van_id`/`my_van_ids()` mechanism Phase C activated.
Write-tool permission is checked against `lib/permissions.ts` both when
the proposal is made and again, independently, when it's confirmed.
`SUPER_ADMIN` has no special path into FoodTaxi AI at all — it is a
business-role feature only, per `lib/staffContext.ts` never resolving a
super admin's own conversations differently from anyone else's.

### 52. Approved tools (E5)

`lib/ai/tools/` — `sales.ts` (business overview, sales summary, top
products, payment/channel breakdown, van comparison), `stock.ts` (low/out
of stock, item lookup, wastage), `suppliers.ts` (open purchase orders,
supplier spend — explicitly flags incomplete cost data rather than
under-reporting silently), `staff.ts` (who's working, timesheet totals —
name/role/van only, never phone/email), `hygiene.ts` (checklist status,
"no record found" rather than guessing), `vehicles.ts` (vehicle/equipment
alerts and history), `events.ts` (upcoming bookings), `operations.ts`
(automation alerts, van schedule, the combined "what needs my attention"
summary), `actions.ts` (the one write-proposal tool). All dates/revenue
math happen in these handlers, in plain TypeScript, against real rows —
never asked of Claude (E7, E33).

### 53. Date understanding (E8)

`lib/ai/dateRange.ts` — a **closed enum** of phrases
(`today`/`yesterday`/`this_week`/`last_week`/`this_month`/`last_month`/
`last_<weekday>`) is what every date-taking tool's schema restricts
Claude to. There is no free-text date parser for the model to get
creative with — an out-of-range phrase is a schema violation the model
self-corrects on. Resolution uses the business's own `timezone` (Phase
D's `nowInTimezone()`), never UTC.

### 54. Explaining analytics — fact vs explanation (E19)

Enforced in the system prompt (`lib/ai/assistant.ts`'s `systemPrompt()`,
rule 4): measured changes ("orders fell 18%") must come from a tool
result; anything offered as a possible cause must be introduced as "one
possible contributor is..." and never stated as fact. This is a prompting
constraint, not a code-enforced one — documented as such rather than
overclaiming a guarantee the architecture can't actually make.

### 55. Marketing / writing assistance (E20, E21)

Fully supported as **conversational drafting** — the model can write a
Facebook post, a closure notice, a supplier email, etc. in its reply text.
There is no dedicated tool or pending-action type for this (unlike the
purchase-order proposal): a draft is just text in the chat, and the system
prompt (rule 6) explicitly forbids Claude from ever claiming to have sent
or published anything. Sending it for real still goes through FoodTaxi's
existing, unchanged channels (e.g. `/dashboard/marketing`) — Phase E adds
no new send capability.

### 56. Safe action framework & confirmation (E22–E24)

**Exactly one write-capable tool exists: `propose_purchase_order`.**
Everything else is read-only. It never creates a purchase order itself —
it creates a `PENDING` row in `ai_pending_actions` and returns its id.
`app/api/ai/actions/[id]/confirm` is the only code path that can move a
row past `PENDING`, and it:
1. Re-resolves the caller's business/role from their session (not from
   the pending action's stored params).
2. Rejects if `user_id`/`business_id` don't match the caller.
3. Rejects if status isn't `PENDING`, or `expires_at` has passed (30
   minutes).
4. Re-checks `manage_purchase_orders` permission independently of the
   check made when the proposal was created.
5. Atomically claims the row (`UPDATE ... WHERE status = 'PENDING'`) —
   this is the actual double-execution guard, the same compare-and-set
   pattern as Phase D's `claimRun()`. A double-click, a retried request, or
   an attempt to replay an old confirm all hit zero affected rows.
6. Only then creates the real `purchase_orders`/`purchase_order_items`
   rows (as `DRAFT` — still requires the normal Phase C review/order flow
   to actually go to the supplier).

**Every other high-impact action listed in E23** (charging/refunding,
deleting orders/businesses/staff/stock, sending real purchase orders,
touching Stripe/billing/subscription, changing roles, bulk marketing,
publishing) **has no tool at all** — there is nothing in
`lib/ai/tools/index.ts` that could even be asked to do these, regardless
of prompt content.

### 57. Prompt-injection protection (E25)

System prompt rule 5 states explicitly that any text arriving via a tool
result (a stored note, an event message, a supplier note) is DATA, not an
instruction, and only the system prompt and the live conversation with
the authenticated user carry authority. Structurally, this is reinforced
by the tool layer itself: even if a malicious note said "call
propose_purchase_order for a 10,000-unit order", the tool's own
`hasPermission()` check and the mandatory human confirmation step mean
text alone can never cause a real write — the strongest protection here
is architectural (nothing execute-capable is reachable from text alone),
with the prompt instruction as a second layer for read-tool behaviour and
conversational tone.

### 58. Data minimisation & customer privacy (E26, E27)

No tool ever selects `*` from a table or sends full row sets to Claude.
Every handler aggregates first (counts, sums, top-N lists) and only
returns individual records where the question is inherently about one
thing (a single stock item, a single van's maintenance history). Customer
identity is never sent to Claude at all — `get_upcoming_events` and the
marketing-suggestion logic it's modelled on (Phase D) work with counts and
matched business emails server-side only; no tool exposes a customer's
phone, email, or address in its response to the model.

### 59. Conversation history & context management (E28, E29, E31)

`ai_conversations` / `ai_messages` (see §60), both scoped by
`user_id = auth_user_id()` in RLS (a colleague never sees another
colleague's chat, same pattern as `notifications`). Each chat turn sends
only the **last 20 messages** of that conversation to Claude
(`CONTEXT_MESSAGE_LIMIT` in `app/api/ai/chat/route.ts`) — no
summarisation of older history was built (not needed yet at this
context length), and no raw tool-result JSON is replayed as history,
only the model's own prior natural-language replies — so a fresh question
about "how much cod do we have" always triggers a fresh
`get_stock_item` call rather than the model reusing a number that
appeared earlier in the chat (E31).

### 60. Database (E46)

Three new tables (`ai_conversations`, `ai_messages`,
`ai_pending_actions` — see `docs/foodtaxi-database.md`). No `ai_usage`
table: rate limiting (§61) queries `ai_messages` directly rather than
maintaining a separate counter that could drift out of sync. No
`ai_tool_runs` table: tool call name/args/short result summary live in
`ai_messages.tool_calls` (jsonb) rather than a fifth table, since they're
inherently one-to-one with the assistant message that produced them.

### 61. Rate limiting & cost control (E33, E35)

`app/api/ai/chat/route.ts` — 40 user messages per hour per person
(`RATE_LIMIT_MESSAGES_PER_HOUR`), counted directly from `ai_messages`
(no separate usage table to keep in sync). No new subscription tier
gates this. Deterministic work (date resolution, revenue sums, day-count
arithmetic) is always done in TypeScript inside the tool handlers —
Claude is never asked to compute a total or a date difference itself.

### 62. Audit logging (E39)

`ai_pending_actions` itself is the audit trail for the one write action
(who proposed it, when, what was confirmed, what was executed, or why it
failed) — no duplicate entry is written to `audit_logs` for the proposal
step, only `logAuditEvent()` at actual execution
(`ai.action_executed`, in `app/api/ai/actions/[id]/confirm`), consistent
with Phase C/D's "audit meaningful changes, not every read" principle.
No hidden chain-of-thought is ever stored — `ai_messages.tool_calls`
holds the tool name, the validated arguments, and a truncated (300
character) summary of the result, not the model's reasoning.

### 63. Error handling (E40)

Tool handler failures are caught in `lib/ai/assistant.ts` and turned into
`{ error: "This data could not be retrieved right now." }` — passed back
to Claude as the tool result, so it can tell the user plainly rather than
inventing an answer. The real error (`console.error`) stays server-side
only.

### 64. Mobile experience & voice input (E41, E42, E43)

`components/ai/FoodTaxiAI.tsx` — quick-prompt chips (TODAY/SALES/STOCK/
STAFF/HYGIENE/VEHICLES/EVENTS) so a phone user rarely has to type a full
question, a sticky bottom input bar, and touch-sized Confirm/Cancel
buttons for pending actions. **Voice input** uses the browser's native
`SpeechRecognition`/`webkitSpeechRecognition` API as a progressive
enhancement — the microphone button only renders when that API exists on
the device (most reliably Chrome/Edge/Safari on iOS 14.5+; not universal,
particularly on desktop Firefox), and typing always remains available
regardless.

### 65. Not built in Phase E (see the completion report for the full list)

- Any write-capable tool beyond the one purchase-order proposal
- Business-configurable AI settings (rate limit, model) beyond env vars
- Summarisation of conversation history beyond the last 20 messages
- A dedicated UI affordance for "send this draft" — marketing/message
  drafts are copy-and-paste from the chat into FoodTaxi's existing send
  flows, not a one-click send from the AI itself (deliberately — E20/E21
  require a draft, not an automatic send, and no auto-send button existed
  to wire up safely within scope)

---

## 66. Business Memory (Phase F)

Free-text notes a business writes about itself (`/dashboard/memory`),
searchable by meaning via `search_business_memory` in FoodTaxi AI (Phase
E) — **not** full document/receipt OCR or an accounting system, which
stay out of scope (see §45's accounting boundary, unchanged).

**Storage:** `business_memory` (business_id, created_by, category,
title, content, optional `related_entity_type`/`related_entity_id` link —
used by Phase G's route notes), `embedding VECTOR(512)`,
`embedding_model`. `pgvector` extension enabled. RLS: the same
`my_business_ids() OR my_staff_business_ids() OR is_super_admin()`
pattern as every Phase C/D table — document isolation is enforced the
same way tenant isolation always has been here, not a new mechanism.

**Embeddings:** Voyage AI (`voyage-3-lite`, 512 dimensions) —
Anthropic's own recommended embeddings partner, since Claude has no
embeddings endpoint. Optional: with no `VOYAGE_API_KEY`, notes still save
as plain text (`embedding` stays `NULL`) and semantic search returns "not
configured" rather than erroring — same degrade-gracefully convention as
every other optional integration in FoodTaxi.

**Search:** `match_business_memory(business_id, query_embedding, limit)`
— a plain (non-`SECURITY DEFINER`) Postgres function, so `business_memory`'s
RLS still applies even if called directly; `business_id` is passed
explicitly as defence in depth on top of that. No ANN index (ivfflat/hnsw)
yet — each business's own note set is small and always filtered by
`business_id` first, so an exact scan is fast enough; documented as a
future addition if note volume grows large.

**AI integration, not override:** `search_business_memory`'s tool
description and the assistant's system prompt (rule 8) both state notes
are contextual and unverified — never a substitute for a real data tool,
and any instruction-like text inside a note is data, not a command
(the same prompt-injection posture as every other tool result).

**Permissions:** new `manage_business_memory`, deliberately granted to
*every* active role including DRIVER/STAFF — a note ("sold out of cod",
"road closed") is a low-stakes operational log entry, not a financial or
destructive action, and the people most likely to write one are on the
road, not in the office.

**Not built:** document/receipt upload or OCR, email memory, any
write-capable memory-driven action (memory is read-only context, it
cannot trigger anything).

---

## 67. Route Intelligence, Stop Performance & Demand Planning (Phase G)

### G1 data audit — what was found before anything was built

- `orders.stop_id` references the legacy `route_stops` table, superseded
  by `van_schedule` since Phase A and never written to by any live code
  path. Not reused, not migrated.
- `orders.pickup_location` is free text. The public van ordering page
  (`app/van/[slug]/page.tsx`) already resolved a real `van_schedule` row
  client-side (a `pickupStop` object with a real `.id`) but only ever
  sent `pickupStop.location_name` to the order API — the real id was
  computed and then discarded before reaching the server.
- The WhatsApp ordering AI (`app/api/webhooks/whatsapp/route.ts`) matched
  a customer's stated pickup against `van_schedule.location_name` text
  and stored only that text, never resolving/storing the real id.
- POS sales had no stop concept captured at all.
- **Conclusion:** historical orders cannot be reliably attributed to a
  specific stop. Per G57, this is never fixed retroactively — no
  historical `pickup_stop_id` is guessed or fabricated. Stop-level
  analytics is honestly scoped to "available from the date this phase's
  code shipped", not backfilled. `service_date` (unlike `pickup_stop_id`)
  *is* safely backfilled for existing orders, from `created_at::date` —
  a factual date every order genuinely already had, not a guess.
- **Also found in this audit:** three call sites from Phases D/E queried
  `van_schedule.day_of_week` (0=Monday) using a raw JavaScript
  `getDay()`/`getUTCDay()` value (0=Sunday) directly — off by one every
  day but Sunday. Fixed via a new shared helper,
  `lib/schedule/dayOfWeek.ts`'s `scheduleDayOfWeek()`, applied to
  `lib/automations/evaluators/reports.ts` (daily briefing),
  `lib/automations/evaluators/staff.ts` (tomorrow's unassigned-shift
  check), and `lib/ai/tools/operations.ts` (`get_van_schedule`). This is
  an application-code fix, not a schema change — a real regression found
  and corrected as part of Phase G, not new Phase G behaviour.

### Canonical route/stop identity (G2)

`van_schedule` (the existing weekly recurring template table) is reused
**as-is** as "the stop template" — no competing stops table was created.
Two new tables express "what actually happened on a specific date" as
something distinct from the template:

- **`route_sessions`** — one row per `(van_id, service_date)`
  (`UNIQUE` constraint), `status` `active`/`completed`/`cancelled`,
  `started_at`/`by`, `ended_at`/`by`. Starting a session is entirely
  optional (G9) — POS, guest ordering and WhatsApp ordering all work
  identically whether or not a business ever starts one.
- **`route_session_stops`** — one row per stop visited in a session,
  snapshotting `location_name`/`scheduled_arrival`/`scheduled_departure`
  from `van_schedule` **at the moment the session starts** (deliberately
  denormalised, the same principle `order_items` already uses for menu
  item name/price, so a later schedule edit never rewrites a historical
  session's record). `van_schedule_id` is nullable so an ad-hoc stop can
  still be logged. `actual_arrival_at`/`actual_departure_at` are set only
  by an explicit manual action (G10) — never inferred from the scheduled
  time.

`lib/routes/sessions.ts`: `getSessionForDate()` (read-only),
`startRouteSession()` (idempotent — the `UNIQUE(van_id, service_date)`
constraint backs this at the database level too; calling it twice the
same day returns the existing session), `endRouteSession()`,
`markStopStatus()`, `currentStopFor()` (the sensible-default stop for a
fresh POS sale: the first `arrived` stop, else the first `pending` one —
staff can always override).

### Future order stop attribution (G3–G7)

`orders.pickup_stop_id` (nullable FK to `van_schedule`, `ON DELETE SET
NULL`) and `orders.service_date` (nullable `DATE`) were added. Every
order-creation path now resolves and verifies a stop id server-side
before storing it — **never trusts a client-sent id directly**:

- **POS** (`app/api/orders/pos/route.ts`) — accepts an optional
  `pickup_stop_id`, re-verified against `van_schedule` for that exact
  `van_id` before use. The POS till (`app/(business)/dashboard/pos/page.tsx`)
  shows a `CurrentStopBanner` (only when a route session exists for
  today) defaulting to the session's current stop, always overridable,
  never required.
- **Guest/online ordering** (`app/api/orders/guest/route.ts`,
  `app/van/[slug]/page.tsx`) — the pickup-day picker already resolved a
  real `van_schedule.id` client-side; it's now actually sent and
  re-verified server-side against `van_id`, alongside a bounded
  (today .. +13 days) `service_date`.
- **WhatsApp ordering** (`app/api/webhooks/whatsapp/route.ts`) — a new
  `resolvePickupStop(dayLabel, locationText)` matches the customer's
  stated day/location against that day's real `van_schedule` rows
  case-insensitively, never trusting the AI's free-text extraction
  directly. Wired into both the "pickup details" follow-up and the
  "new order" insert path.

### Route/stop performance analytics (G12–G20, G37, G38)

`lib/routes/analytics.ts` — one shared module used by **both** the
dashboard (`/api/routes/analytics`, `?type=route|stop|compare|
day-of-week|time-of-day|products|anomalies`) and the FoodTaxi AI route
tools, so the two surfaces can never disagree.

- Revenue rule: identical to Phase B (`sum(orders.total)` excluding only
  `status='cancelled'`) — but dated by `orders.service_date`, not
  `created_at`. This is a deliberate, documented difference from Phase
  B/D's own analytics, which are untouched and still use `created_at`;
  retrofitting those is a separate, riskier change outside this phase's
  scope.
- Stop-level functions (`getStopPerformance`, `compareStops`,
  `getProductByStop`) query by `pickup_stop_id`, so they are only
  populated from the date this phase's code shipped — consistent with
  the G1 audit's conclusion.
- `revenue_per_hour` is computed **only** from real recorded
  `actual_arrival_at`/`actual_departure_at` durations in
  `route_session_stops` — never from the scheduled template time as a
  stand-in. Returns `null` with an explanatory message when no session
  data exists for the period, rather than a misleading number.
- `getDayOfWeekPerformance()` — average revenue/orders/AOV per weekday
  with an explicit sample size (`trading_days_sampled`) always shown, and
  a trading-day distinction (G37): a date only counts as sampled if it
  had a real order or a non-cancelled route session — a day with
  neither is excluded entirely, never silently counted as a "£0 day".
- `getAnomalies()` (G38) — this date's revenue/orders vs the plain
  average of the last (up to 12 weeks of) comparable same-weekday dates.
  Requires at least 3 comparable days before offering a comparison at
  all; returns a measured percentage difference only, with
  `is_notable: true` only as a ≥20% threshold flag — **never** a claimed
  cause. `compareStops()` never assigns a good/bad label (G15) — the same
  metrics, side by side, full stop.

### Demand planning & loading plans (G21–G26, G41–G45)

`lib/routes/demand.ts` — **transparent statistics only**, per the
explicit instruction to start with a plain method rather than a
black-box model:

- **Method:** the plain average of up to the last 6 comparable days
  (same van, same stop, same weekday) with sales recorded, plus a
  configurable buffer percentage (default 10%). `sample_values` (the
  exact historical quantities used) is persisted alongside every
  estimate — full explainability (G41), not just a final number.
- **Stock quantity per order** is derived via Phase C's optional
  `menu_stock_components` recipe link. No recipe configured for an item
  returns `null` (a distinct fact from "zero sold, no recipe needed") —
  demand for that item simply cannot be estimated until a recipe exists,
  and the UI/AI tool says so explicitly rather than showing a
  misleading `0`.
- **Idempotent & never rewritten (G44):** `demand_estimates` has
  `UNIQUE(van_id, target_date, stock_item_id)` — the first calculation
  for a given day is what's stored; repeated calls the same day return
  the existing row rather than recomputing (and never silently changing)
  it. Feedback (`feedback_status`/`feedback_quantity`/`feedback_at`/
  `feedback_by`, G45 — `used`/`adjusted`/`ignored`, recorded via
  `POST /api/routes/demand/feedback`) is appended in separate columns,
  never overwriting the original `baseline_quantity`/`suggested_quantity`.
- **`getLoadingPlan()`** — every recipe-linked stock item for a van's
  stop on a future date: suggested quantity, current van stock, current
  warehouse stock, and the shortfall (`max(0, suggested - van -
  warehouse)`) — a number, never an automatic transfer.
- **Turning a shortfall into action (G26):** `propose_stock_transfer`
  (the FoodTaxi AI tool, `lib/ai/tools/routes.ts`) and
  `POST /api/routes/demand/propose-transfer` (the plain dashboard button
  in `/dashboard/routes` → Demand & Loading) both create exactly the same
  kind of row — a `PENDING` `ai_pending_actions` row with
  `action_type: 'create_stock_transfer'` — reusing Phase E's existing
  confirmation framework exactly as instructed (G63), not a second
  parallel mechanism. Confirming it (`POST /api/ai/actions/[id]/confirm`,
  extended with a `create_stock_transfer` branch) calls Phase C's
  `apply_stock_movement()` RPC twice (a `TRANSFER_OUT` from the
  warehouse, a `TRANSFER_IN` to the van), exactly as a manual transfer
  already does via `/api/stock/transfer` — never a direct quantity
  overwrite.

### FoodTaxi AI route tools (G39, G40)

`lib/ai/tools/routes.ts`, registered into `ALL_TOOLS`
(`lib/ai/tools/index.ts`): `get_route_performance`,
`get_stop_performance`, `compare_stops`, `get_day_performance`,
`get_product_sales_by_stop`, `get_route_anomalies`,
`get_loading_suggestion`, `get_stock_shortfall`,
`propose_stock_transfer`. All nine call the exact same
`lib/routes/analytics.ts`/`lib/routes/demand.ts` functions the dashboard
uses. Date-range tools use a new `resolveInclusiveDateRange()`
(`lib/ai/dateRange.ts`) rather than Phase E's `resolveDateRange()`
directly — the latter returns a timestamp-EXCLUSIVE end suited to
`created_at` queries; Phase G's analytics filter a plain `DATE` column
(`service_date`) inclusively, and reusing the exclusive value directly
would have silently included one extra day in every range (found and
fixed before shipping — see the code comment in `dateRange.ts`). The
assistant's system prompt (`lib/ai/assistant.ts`) gained rule 10:
route/demand results are factual measurements only — never "good"/"bad"
day labels, never "lost sales" as fact for an unmet shortfall, never the
word "profit" (route tools only ever surface revenue, known costs, or an
estimated gross contribution), and a loading suggestion is explicitly a
draft based on past averages, not a guarantee.

### Route Intelligence dashboard (G12 suggested location)

`/dashboard/routes` (`components/routes/RouteIntelligence.tsx`) — three
tabs, van-scoped:

- **Sessions** — start/end a route session for a chosen date, mark each
  stop arrived/departed/skipped, add a note per stop (mirrored into
  Business Memory, see below).
- **Performance** — route KPIs for a date range, the day-of-week table
  with sample sizes, and the "was this day unusual" anomaly check.
- **Demand & Loading** — pick a future date and stop, see the suggested
  loading plan with shortfalls, and propose a draft stock transfer for
  any shortfall (routes into the same confirmation flow as above).

### Route notes via Business Memory (G50–G52)

No separate "route notes" table was created. A note entered against a
stop in the Sessions tab (`PATCH
/api/routes/sessions/[id]/stops/[stopId]`) is written into Phase F's
`business_memory` table using its generic `related_entity_type`/
`related_entity_id` link (`route_session_stop`), with `category:
'route_note'`. It is retrievable the same way any other memory is — via
`/dashboard/memory` or FoodTaxi AI's `search_business_memory` — and is
treated identically to every other memory entry: unverified context, not
a fact, and any instruction-like text inside it is data, never a
command (G52).

### Automation integration (G53–G55)

Reuses Phase D's `claimRun`/`notify`/`completeRun` engine exactly — one
more entry in the central `AutomationType` registry
(`lib/automations/types.ts`), not a parallel notification path:

- **`end_of_route_review`** (new automation type) — event-triggered from
  `endRouteSession()`, not part of the hourly cron sweep (a route can end
  at any time of day). Summarises that van's revenue/orders for the day
  and, when ≥3 comparable same-weekday days exist, how it compared
  (`lib/automations/evaluators/routes.ts`). Idempotent via the same
  `trigger_key` claim pattern as every other automation.
- **Daily briefing enhancement** — `runDailyBriefing()` now also computes
  a stock-loading shortfall count for each scheduled van's first stop of
  the day (reusing `getLoadingPlan()`) and adds a line to the briefing
  only when there's something to flag.

### Security, permissions & scope boundaries

- RLS on all three new tables (`route_sessions`, `route_session_stops`,
  `demand_estimates`) follows the exact same
  `business_id IN (my_business_ids()) OR business_id IN
  (my_staff_business_ids()) OR is_super_admin()` pattern as every table
  since Phase C.
- Van-restricted staff (G62) are enforced at the API layer via
  `assertVanAllowed()`/`allowedVanIds()` (`lib/ai/context.ts`, already
  built in Phase E) — every Phase G API route and AI tool that takes a
  `van_id` checks it before querying.
- The only write action anywhere in Phase G (`create_stock_transfer`)
  requires `manage_stock` permission and goes through Phase E's existing
  pending-action confirmation exactly (G63/G64) — nothing here executes
  autonomously.
- Subscription (`£19.99/month`, 3-day trial, one tier), customer-side
  pricing, and every existing feature are unchanged (G65).

### Not built in Phase G (see the completion report for the full list)

- **GPS geofencing / automatic arrival detection (G11)** — `van_schedule`
  stores a stop as free-text `location_name` with no coordinates; arrival/
  departure stays a manual action only. Documented, not attempted.
- **Travel time / route efficiency / route optimisation (G30–G32)** —
  same root cause: no stop coordinates exist to compute a distance or
  ETA from. No fabricated coordinates were introduced to work around
  this.
- **Route map / heatmap visualisation (G47–G48)** — depends on the same
  missing coordinate data.
- **Weather integration (G35)** — no architecture beyond noting the same
  extension point Phase D's automation settings already provide (a new
  automation type reading an external API) would be where this belongs;
  no external weather call is made.
- **Any historical `pickup_stop_id` backfill** — explicitly forbidden by
  G57; only `service_date` was safely backfilled from `created_at`.
- **Full accounting / true profit** — route figures are revenue, known
  costs, and an estimated gross contribution only, never "profit" (G29,
  G66 — no general ledger, no full accounting).
- **Autonomous route changes** — route optimisation suggestions, stop
  removal, and stock transfers all require explicit owner confirmation;
  nothing in Phase G ever writes without it (G32, G33, G67).
