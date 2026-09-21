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

---

## 68. Finance, Expenses, Reconciliation & Accounting Hub (Phase H)

### H1 data audit — what already exists and is never duplicated

- `orders.total`/`subtotal`/`vat_amount`/`status`/`payment_method`/
  `source` — the one source of sales revenue. Phase H's finance module
  reads these directly and never re-derives or re-stores a sales figure.
- `subscriptions`/`subscription_plans` (the £19.99/month FoodTaxi
  platform subscription) and `event_applications.foodtaxi_fee` (the
  £29.99 event booking fee) are both structurally separate from a
  business's own food revenue already — Phase H's finance queries never
  read either as business income (H2).
- `purchase_orders`/`purchase_order_items` (Phase C) had no invoice
  number, VAT split, or payment tracking — that gap is exactly what the
  new `supplier_invoices` table fills, linked to a PO via
  `purchase_order_id`, never replacing it.
- `stock_items.cost_price`, `wastage_records.cost`,
  `vehicle_maintenance.cost`, `equipment_maintenance.cost` — already
  authoritative. Vehicle/equipment costs are read directly from those
  tables in Phase H's reports, never re-entered as an `expenses` row
  (that would be exactly the "second financial truth" this audit warns
  against). An `expenses` row in category `vehicle`/`repairs`/`equipment`
  is only for a cost NOT already captured there (e.g. a parking fine).
- No file/document storage infrastructure (a Supabase Storage bucket,
  signed URLs) exists anywhere in the app — see "Not built" below.
- **Conclusion (H7):** no ledger abstraction table was created. Each
  money-moving fact (a sale, a refund, an expense, a supplier invoice, a
  cash count) keeps its own single source-of-truth table; reporting
  composes these at query time in `lib/finance/*`, exactly the way Phase
  G's route analytics compose `orders` + `route_session_stops` without a
  separate materialised table.

### Money precision & rounding (H79)

Every money column is `NUMERIC(12,2)` (exact decimal, never a float
column) — the same convention every existing money column in the schema
already uses (`orders.total` is `DECIMAL(10,2)`). `lib/finance/money.ts`'s
`round2()` is the one rounding function every calculation in Phase H
goes through, mirroring the `round2()` already used by Phase B/D/G. An
integer-minor-units convention was deliberately NOT introduced — it
would be inconsistent with 50+ existing DECIMAL columns across the app
for no real precision gain (`NUMERIC` has no floating-point error).
`businesses.currency` (new column, default `'GBP'`) documents the
single-currency assumption at the schema level without building
multi-currency conversion (H80).

### Revenue & payment categorisation (H4–H6, H19–H21)

`lib/finance/revenue.ts` reuses Phase B's exact rule (`sum(orders.total)`
excluding only `status='cancelled'`, dated by `created_at`) and adds one
thing Phase B never needed: subtracting recorded `refunds` to get net
revenue. Payment method is categorised as `cash` / `card_recorded`
(POS card — recorded only, never claimed verified or settled — no
card-terminal integration exists) / `verified_online` (Stripe-captured)
/ `other` — the exact provider-neutral distinction H21 asks for.

### Expenses & receipt extraction (H8–H11)

`expenses` (status `CONFIRMED`/`VOID` only — a correction is a new edit
or a void, never a silent rewrite, H56). Categories
(`food_stock`/`drinks`/`packaging`/`fuel`/`vehicle`/`repairs`/
`equipment`/`insurance`/`rent_storage`/`phone_internet`/`marketing`/
`staff`/`cleaning`/`professional_fees`/`other`) are plain labels — they
never imply a VAT treatment (H9); net/VAT/gross are entered or reviewed
explicitly per expense.

**Receipt → extract → review → confirm → expense (H11):** reuses the
exact pattern `app/api/menu/scan` already established — a base64 image
sent to Claude vision, a structured JSON result back
(`POST /api/finance/documents/extract`). The result is staged in
`finance_documents.extracted_data` as `PENDING`/`EXTRACTED`, never
authoritative until a person reviews the pre-filled form in
`/dashboard/finance` → Expenses and explicitly saves it — only then does
a real `expenses` row exist (`finance_documents.extraction_status` moves
to `CONFIRMED`). **The source image itself is never persisted** — no new
file storage/signed-URL infrastructure was introduced in this phase (see
"Not built").

Duplicate detection (`findPossibleDuplicateExpense`) flags a same-
supplier/same-date/same-amount match into `finance_review_items` — it
never blocks or auto-merges the new entry (H54).

### Supplier invoices, payments & PO matching (H12–H15)

`supplier_invoices` is header-level only (net/VAT/gross totals, not
per-line items) — matched against a linked PO's own already-line-level
`purchase_order_items` (`quantity_ordered`/`quantity_received`/
`unit_cost`) for the three-way PO-vs-goods-received-vs-invoice review
(`lib/finance/matching.ts`'s `getPoInvoiceMatch`, surfaced on
`GET /api/finance/supplier-invoices/[id]`). A >5% difference is flagged,
everything is still shown regardless of the flag. Duplicate-safe
numbering: `UNIQUE(business_id, supplier_id, invoice_number)` where an
invoice number is present (a receipt with no number is never treated as
a duplicate).

`amount_paid`/`outstanding_balance` are computed at query time from
`supplier_invoice_payments`, never stored — there is exactly one place a
payment total can be. Overpayment is prevented by the API checking the
outstanding balance before insert (H13); `status`
(`UNPAID`/`PARTIALLY_PAID`/`PAID`) is derived automatically from the
actual payment total, never set independently, so it can never drift.

### Cash & card reconciliation (H16–H21)

`lib/finance/cash.ts` implements the formula exactly as specified:
`opening float + cash sales − cash refunds − recorded cash expenses =
expected cash`, `actual − expected = variance`. Figures
(`cash_sales_recorded`, etc.) are **snapshots taken at count time**, not
live-recomputed later — a correction made afterwards to an order or
expense never silently rewrites a historical count (H56). A count
accepts either a direct total or a UK denomination breakdown (£50 down
to 1p, `totalFromDenominations()`). One count per `(van_id,
service_date)`; a `route_session_id` link is optional, for forward
compatibility with per-session granularity, not required.

Card reconciliation compares FoodTaxi's own card-recorded total against
a manually-entered external terminal total, with a free-text `provider`
field (SumUp/Square/Zettle/Stripe/Other) — never labelled a "settlement"
or "bank receipt" anywhere, since no provider integration exists (H19).

A ≥£5 variance on either flags a `finance_review_items` row.

### Refunds (H22/H23)

A dedicated `refunds` table, never a mutation of `orders.status` — the
`order_status` enum and every existing order-status UI is completely
untouched. Revenue queries subtract matching refunds explicitly instead.
No real provider refund is ever issued (no approved payment-provider
integration exists to call) — `status` is a single `'RECORDED'` value.
Overpayment beyond the order total is prevented by the API.

### COGS, gross contribution & wastage (H24–H27)

`lib/finance/cogs.ts` — **chosen method: "latest confirmed cost"**
(`stock_items.cost_price`), the simpler of the two explicitly-permitted
options, since no per-sale historical cost exists anywhere in the schema
(`stock_movements` has no `unit_cost` column) to average over. This is a
documented, deliberate limitation: editing a stock item's cost price
changes the cost basis a past period's report uses the next time it's
generated — nothing stored is ever silently rewritten (every call
recomputes fresh from the current recipe + current cost). A true
point-in-time cost snapshot would require adding a cost column to
`stock_movements` — judged out of scope for this phase.

Revenue is split into known-cost (every recipe component has a
`cost_price`) and unknown-cost (no recipe at all, or an incomplete one).
**Gross contribution is only ever computed over the known-cost portion**,
with `coverage_pct` always shown alongside it, and is never called "net
profit" or "profit" anywhere in the code or UI (H24). Wastage cost
(`wastage_records.cost`, already authoritative) is reported as its own
line, never netted into gross contribution automatically — so nothing is
silently double-counted or hidden (H27).

### Vehicle/equipment/van/route finance (H28–H31)

`lib/finance/reports.ts`'s `getVehicleCosts`/`getEquipmentCosts` read
directly from `vehicle_maintenance`/`equipment_maintenance` (by date) —
never duplicated into `expenses`. Equipment with no `van_id` (business-
wide) is included in the business total but never arbitrarily allocated
to a van (H31). `getVanFinance()` combines revenue, known gross
contribution and a van's own directly-attributed vehicle/equipment costs
only. Route-level finance is available by combining this with Phase G's
existing `getRoutePerformance` (same revenue figures, already van/stop
scoped) — no separate route-cost table was introduced.

### VAT (H32–H37)

`vat_settings` (one row per business): `is_registered` defaults `false`
— **never assumed** — with an optional VAT number and a single
`default_rate` (the one place a VAT percentage is configured; nothing
else in Phase H hard-codes a rate, H32). `lib/finance/vat.ts`'s
`getVatSummary()` computes output VAT (`orders.vat_amount` for the
period) and input VAT (`expenses.vat_amount` + `supplier_invoices.
vat_amount`, accrual basis — invoice/expense date, not payment date).
**Explicitly labelled everywhere** — API response, dashboard, and the AI
tool — as "a FoodTaxi record summary for review, not a filed VAT
return." Nothing is submitted to HMRC, no Making Tax Digital connection
exists, no tax return is filed (H37, final safety check). A documented
limitation: output VAT is not reduced for refunds, since `refunds`
carries no VAT split of its own.

### Management report & cash flow (H38–H40)

`getManagementReport()`: sales net revenue → known COGS → gross
contribution → recorded operating expenses (expenses + vehicle +
equipment costs) → recorded operating result, with an explicit
`disclosure` string on every response stating this is not statutory
accounts and that low-coverage revenue is excluded from gross
contribution, not estimated. `getCashFlowView()` distinguishes an actual
payment date (`supplier_invoice_payments.paid_at`, `customer_invoice_
payments.paid_at`) from an invoice/expense's own accrual date — expense
outflow uses `expense_date` as a documented proxy for payment date (no
separate "paid on" field exists for a manual/receipt expense).

### Payables, receivables & customer invoices (H41–H45)

Supplier invoice payables are the `supplier_invoices` list filtered by
status. `customer_invoices`/`customer_invoice_items`/`customer_invoice_
payments` are professional catering/event invoices — **entirely separate
from the £29.99 FoodTaxi event booking fee** (`event_applications.
foodtaxi_fee`), which this feature never reads or writes.
Business-scoped duplicate-safe numbering with an optional prefix
(`UNIQUE(business_id, invoice_number)`). PDF generation reuses the exact
`window.print()` pattern the existing receipt page
(`app/receipt/[id]`) already uses — no new PDF-rendering dependency was
introduced (a dedicated printable invoice page was judged lower priority
than the core ledger/reconciliation work within this phase's scope — see
"Not built").

### Accountant export & accounting integration architecture (H46–H53)

`GET /api/finance/export?type=...` — CSV only (no XLSX dependency was
judged worth adding for this). Types: `sales`, `expenses`,
`supplier_invoices`, `payments`, `refunds`, `cash`, `vat`, `cogs`. Sales
rows never include `guest_name`/`guest_email`/`guest_phone` — only an
order number, date, van, payment category, and amounts (H51). Custom
date range required on every export (H49).

`finance_account_mappings` is a **provider-neutral architecture only** —
a business can label an expense category with an external chart-of-
accounts code/name, surfaced as an extra `mapped_account` column on the
expenses export. **No real Xero/QuickBooks connection exists or is
called anywhere** — editing a mapping is explicitly documented as not
tax advice (H53), identical in nature to choosing an expense category.

### Finance review queue, duplicates, audit & period locking (H54–H57)

`finance_review_items` — one generic queue table (`item_type` + a
pointer to the record) rather than one table per reason:
`duplicate_expense`, `uncategorised_expense`, `missing_supplier`,
`unknown_vat`, `cash_variance`, `card_variance` are all created
automatically at the point the underlying fact is recorded;
`invoice_po_mismatch` and `extraction_review` are computed on demand
(surfaced via the PO-match/extraction endpoints) rather than scanned for
on a schedule. **Nothing is ever auto-deleted or auto-merged** — a
duplicate is flagged, never silently removed (H54). Every financially
meaningful action (`expense_created`, `expense_edited`, `expense_voided`,
`supplier_invoice_created`, `supplier_payment_recorded`, `refund_recorded`,
`cash_reconciliation_recorded`, `card_reconciliation_recorded`,
`vat_settings_changed`, `period_locked`/`unlocked`, ...) is written to
`audit_logs` via the existing `logAuditEvent()` (Phase C), the same audit
trail every prior phase's higher-risk changes already use.

`finance_periods` provides an optional lock/unlock foundation
(`POST /api/finance/periods`) — locking is itself an authorised, audited
action. **Known limitation:** no write route currently checks whether its
target date falls inside a locked period and refuses the write; this
phase ships the lock as a foundation and audit record, not yet full
write-blocking enforcement (see "Not built").

### Permissions & the ACCOUNTANT role (H58/H59)

Thirteen new granular permissions (`view_finance_summary`,
`view_sales_finance`, `view_expenses`, `create_expense`,
`approve_expense`, `manage_supplier_invoices`, `record_supplier_payment`,
`perform_cash_count`, `view_cash_variance`, `view_vat`, `edit_vat`,
`export_finance`, `manage_finance_settings`) added to the existing
central `lib/permissions.ts` registry — no separate finance-permission
system. **New `ACCOUNTANT` role** (`ALTER TYPE user_role ADD VALUE
'accountant'`, the same safe additive pattern Phase C used for
`business_admin`): finance permissions only, **zero** operational-admin
grants (no `manage_stock`, `manage_staff`, `use_pos`, etc.) — exactly
H58's "no automatic operational-admin rights." `BUSINESS_ADMIN` gained
full finance access (a trusted manager already gets nearly everything
else); `VAN_MANAGER`/`DRIVER`/`STAFF` gained only enough to log an
expense and perform a cash count at their own van — "minimal finance
access by default" (H59).

### FoodTaxi AI finance tools (H60–H65)

`lib/ai/tools/finance.ts` — nine tools, registered into `ALL_TOOLS`:
`get_finance_summary`, `get_expenses_summary`, `get_gross_contribution`,
`get_vehicle_costs`, `get_supplier_invoice_status`, `get_cash_variance`,
`get_vat_summary`, `get_finance_review_items`, `get_management_report`,
plus **one** write-capable tool, `propose_expense` — which, exactly like
Phase E's `propose_purchase_order` and Phase G's `propose_stock_transfer`,
only ever creates a `PENDING` `ai_pending_actions` row for the user to
confirm themselves (`create_expense` extends the existing
`/api/ai/actions/[id]/confirm` switch, the one place any AI-proposed
action ever actually executes). **The AI has no tool at all** — gated or
otherwise — for recording a payment, voiding an invoice, issuing a
refund, changing VAT registration, locking a period, or deleting
anything (H65): those actions simply don't exist as callable tools. The
system prompt (`lib/ai/assistant.ts`, rule 11) requires the assistant to
distinguish recorded fact from calculation from a data gap, never call a
VAT summary a filed return, and never give authoritative tax/legal
advice.

### Automation integration (H66)

Four new automation types (`lib/automations/evaluators/finance.ts`,
reusing Phase D's `claimRun`/`notify`/`completeRun` engine exactly, run
from the existing hourly cron sweep): `invoice_due_reminder`
(7/1-day-before + daily-overdue, same exact-day-threshold pattern as
Phase D's vehicle reminders), `finance_review_digest` (one daily
notification summarising the whole open review queue by type, not one
notification per item), `vat_period_reminder` (monthly, only for
VAT-registered businesses, never assumed), and `daily_finance_summary`
(optional, default OFF — same convention as Phase D's
`end_of_day_summary`). Business Memory (Phase F) and Route Intelligence
(Phase G) are referenced only through existing shared data (van/route
figures) — no new coupling was added into either of those tables.

### Completeness indicators & month-end checklist (H66/H71)

`GET /api/finance/checklist` — COGS cost coverage %, receipt coverage %
(expenses with a linked document vs without), open review-item count,
unpaid supplier invoice count, and a simple checklist of whether each is
clear — read-only, informational; it never locks anything itself.

### Not built in Phase H (see the completion report for the full list)

- **File/document storage + signed URLs** — no Supabase Storage bucket
  exists anywhere in the app yet; receipt/invoice images are sent
  directly to Claude vision for extraction and never persisted server-
  side. `finance_documents.file_url` stays an optional external link
  only, the same convention `vehicle_documents`/`hygiene_documents`
  already use.
- **Per-line supplier invoice items** — invoices are header-level
  totals only, matched against the PO's existing line items.
- **A true historical cost snapshot for COGS** — "latest confirmed cost"
  is used instead; see the COGS section above.
- **Write-blocking period-lock enforcement** — `finance_periods` is a
  lock/audit foundation; no write route yet refuses a write because its
  date falls inside a locked period.
- **A dedicated printable customer-invoice page** — PDF generation via
  `window.print()` (the receipt pattern) is architected but no dedicated
  print-layout page was built in this pass.
- **Real Xero/QuickBooks/bank-feed/open-banking integration** — mapping
  architecture only; nothing is called, no bank credentials are ever
  requested or stored (final safety check).
- **HMRC/Making Tax Digital submission** — never built, never planned
  for this phase; VAT is a recorded summary only.
- **Stripe Connect / real card-provider settlement verification** —
  explicitly not activated; card-recorded sales are never claimed
  verified.

---

## 69. Customer Growth, Loyalty, CRM & Retention (Phase I)

### I1 data audit — what was found before anything was built

- Authenticated `customers` accounts are rare — POS, guest/online and
  WhatsApp ordering (the dominant volume) all create orders with
  `customer_id` NULL, identity carried in `guest_name`/`guest_phone`/
  `guest_email` instead. A CRM built only around `customers` would miss
  almost every real order.
- `email_unsubscribes` is platform-wide (not per-business), keyed by
  email. Preserved completely unchanged and treated as an absolute
  floor — no business, preference, or campaign in Phase I can ever
  re-enable email to a suppressed address.
- `whatsapp_customer_prefs` is **not** a consent table despite its
  name — it only tracks WhatsApp ordering conversation state (last van
  picked, pending option list). There was no existing WhatsApp
  marketing-consent mechanism at all, so WhatsApp marketing opt-in
  defaults to `false` for every customer, never inferred from having
  ordered by WhatsApp.
- `whatsapp_messages` (inbound message log) is reused as-is to compute
  the WhatsApp 24-hour session-window eligibility for campaign sending —
  no new table needed.
- `reviews` existed but was completely unused (no reader or writer
  anywhere) and required `customer_id NOT NULL`, unusable for the
  guest-dominant order flow. Fixed in place (nullable `customer_id`,
  `guest_name`/`guest_phone`/`guest_email` added, matching orders'
  convention) rather than replaced.
- `customer_favourite_vans` (authenticated-customer only) is reused
  as-is — not extended to guest identity, since a persisted "favourite"
  inherently needs a stable account to attach to.
- `orders.discount_amount` (Phase B, menu deals) is reused as the one
  field any discount — loyalty reward, voucher, or promo code — is ever
  applied through, rather than each mechanism inventing its own pricing
  path.
- **Regression found and fixed:** POS's "hand over" action updated
  `orders` directly from the browser, bypassing `PATCH
  /api/orders/[id]/status` — the one place Phase C's stock deduction is
  triggered. This meant POS-collected orders were never deducting stock.
  Fixed by routing POS's hand-over through that same API route, which
  also gives it Phase I's loyalty earning and CRM identity tracking for
  free — a genuine regression fix, not new behaviour, found during this
  audit exactly the way earlier phases have found and fixed similar
  gaps.

### Customer identity architecture (I2/I3)

`crm_customers` is a **business-scoped identity + preference table
only** — it never caches order counts, spend, or dates. Those are always
computed live from `orders` at query time
(`lib/crm/profile.ts`/`lib/crm/segments.ts`), the same "compose at query
time from source-of-truth" principle Phase G's route analytics and Phase
H's finance module already established.

Identity resolution is conservative: `identity_key` is `'phone:<E.164
normalised>'` when a phone is known, else `'email:<lowercased>'`, else
`NULL` (no row is created for a truly anonymous walk-in). `UNIQUE
(business_id, identity_key)` is the tenant-isolation boundary — the same
phone ordering from two different FoodTaxi businesses can never merge
into one profile (I81). A `customer_id` link to an authenticated account
is only ever set on an exact phone/email match, never by name (I3).
`crm_customers` is populated going forward from the order-collected hook
(independent of whether loyalty is enabled — CRM identity tracking is a
base feature, loyalty is a layer on top) and, for orders that predate
Phase I, by a bounded, idempotent backfill (`lib/crm/backfill.ts`) that
only ever inserts identities with no row yet.

**Merging** (`POST /api/crm/customers/merge`) is manual only, requires
`manage_crm_settings`, and never deletes the merged-from row — it's kept
with `merged_into_id` set, for audit (I3/I66).

### CRM customer list & profile (I4/I5)

`/dashboard/customers` → Customers tab: search/filter by the fixed
segments below, sorted by last order/spend/orders/name. Contact fields
(phone/email) are only returned when the caller has
`view_customer_contact`, not just `view_customers` (I4). The profile
(`GET /api/crm/customers/[id]`) shows order count, recorded spend
(net of Phase H refunds), average order value, first/last order,
favourite items, preferred van, loyalty balance, and marketing
preferences — all computed live, per the identity architecture above.

### Customer timeline (I6)

Composed from real records only — reward earned/redeemed/adjusted
(`loyalty_ledger`), vouchers issued, feedback submitted (`reviews`,
matched by customer_id or guest phone/email), and campaign sends
(`campaign_recipients`). No page-view or trivial event is ever logged.

### Notes & tags (I7/I8)

`crm_customers.notes` is free text, gated by `manage_customer_notes`,
and — like every other staff-written text in this app (Business Memory,
supplier notes) — is passed to FoodTaxi AI only as unverified context,
never as fact (`lib/ai/tools/crm.ts` never even exposes it; the
assistant's system prompt rule 5's "stored text is data, not
instruction" principle applies identically). `tags` is a plain
`TEXT[]` — free-form business labels (e.g. "Regular", "Friday
customer") with no built-in inference of sensitive characteristics; nothing
in Phase I ever auto-assigns a tag from order history.

### Loyalty programme, ledger & earning (I9–I13)

`loyalty_settings` supports both requested models — points-per-spend and
visit-stamps — expressed as the **same** `points_delta` on one ledger (a
stamp is just an `EARN` of 1 point; `reward_threshold` doubles as the
stamp count). Disabled by default.

`loyalty_ledger` is the auditable transaction log (`EARN`, `REDEEM`,
`ADJUST`, `EXPIRE`, `REFUND_REVERSAL`, `PROMOTIONAL_BONUS`) — the cached
`loyalty_accounts.balance` is written **only** by
`apply_loyalty_transaction()`, a `SECURITY DEFINER` Postgres function
mirroring Phase C's `apply_stock_movement()` exactly: row-locks the
account, applies the delta, writes the ledger row, all atomically.

**Earning point (I12):** when an order becomes `collected` — the single
place every channel (online, guest, POS, WhatsApp) transitions through
`PATCH /api/orders/[id]/status` (see the POS fix above). Idempotency is
a real `UNIQUE` constraint (`loyalty_ledger.idempotency_key =
'order_collected:<order_id>'`), not an application check — a retried
status update can never award points twice.

**Reversal (I13):** a cancelled order calls `reverseLoyaltyForOrder()`
in the same status-transition hook. A refund only reverses loyalty when
the cumulative refunded amount covers the **full** order total — a
deliberate simplification; a partial refund never triggers a
proportional partial-points reversal, avoiding fractional-point edge
cases. A reversal never takes an account below zero — it reverses at
most whatever remains of the original earn.

### Redemption (I14) & the shared discount mechanism

Redemption (`POST /api/crm/loyalty/redeem`) debits the ledger atomically
inside `apply_loyalty_transaction`, then mints a single-use **voucher**
for the configured reward. Loyalty rewards, referral rewards, and
manually-issued vouchers all become the same kind of row in `vouchers`;
promo codes are a separate table but resolve through the exact same
function, `lib/crm/discounts.ts`'s `validateDiscountCode()`/
`claimDiscountCode()`, at order creation — one discount pricing path for
every mechanism, never a second one invented per feature (I9's spirit
applied to the whole phase). Only one discount code applies per order,
ever (`promo_redemptions.order_id` is `UNIQUE`) — no stacking of two
codes; a menu deal's own existing discount (Phase B) can combine with
one code, a simple and predictable rule (I22).

### Loyalty QR & POS/online/WhatsApp integration (I16–I19)

The "QR identifier" is `crm_customers.id` itself — a random UUID with
nothing derived from the customer's name or phone encoded in it (I16).
POS gets a lookup widget (phone or that id) showing balance, progress,
and an available reward, with server-validated redemption
(`components/crm/PosLoyaltyWidget.tsx`). Online/guest checkout resolves
and prices a promo/voucher code entirely server-side
(`app/api/orders/guest/route.ts`) — the client's own claimed total is
never trusted for the discount portion. **WhatsApp loyalty display was
not built** — the ordering AI already has enough scope; wiring balance
display into that flow risked destabilising a working, higher-stakes
ordering path for a lower-value display feature, so it's documented as
future work rather than attempted (see "Not built").

### Promo codes, stacking & vouchers (I20–I23)

`promo_codes`: fixed-amount/percentage, date range, minimum spend,
redemption limits (total and per-customer), eligible vans/channels,
new-customers-only. Redemption is a `SECURITY DEFINER` function
(`redeem_promo_code`) that row-locks the code and re-checks every limit
**inside** the lock — the actual protection against two simultaneous
orders over-redeeming a limited code, not an application-level
check-then-insert with a race window. `vouchers` are explicitly a
promotional/discount instrument only — no cash-out, no stored balance
beyond the one discount value (I23).

### Referrals (I24/I25)

A referrer's opaque code (`referral_codes`, one per customer,
staff-generated from the profile page) qualifies when the **referred**
customer's genuinely first completed order uses it
(`referral_conversions.qualifying_order_id` is `UNIQUE` — idempotent).
Self-referral is prevented by comparing `identity_key`, never a name.
Both rewards (if enabled) are minted as vouchers via the same mechanism
as loyalty redemption. A fully self-service customer-facing referral
portal was **not** built — codes are generated by staff from the
customer profile for now (see "Not built").

### Favourites & reorder (I26/I27)

`customer_favourite_vans` reused as-is for authenticated accounts.
A "quick reorder" UI was **not** built in this pass — the existing
guest/online ordering flow already re-validates menu/price/availability
fresh on every order (nothing in Phase I changed that), so building
reorder would mean adding a shortcut UI on top of an already-correct
validation path; judged lower priority than the CRM/loyalty/promo core
within this phase's scope (see "Not built").

### Segments (I28–I30)

Six fixed, documented segments computed from order history only — `new`
(first order ≤30 days ago), `active` (ordered ≤30 days ago), `regular`
(3+ orders, last ≤60 days), `lapsed` (no order in the last 60 days,
configurable), `high_frequency` (10+ orders in 90 days), `high_spend`
(recorded spend ≥ a threshold). `lib/crm/segments.ts`'s
`computeSegmentMembership()` is the **one** place these definitions
live — the dashboard, campaign audience builder, retention analytics,
and AI tool all call it, so a segment count can never disagree between
surfaces. Nothing infers a segment from anything beyond order date/
count/spend/van — no sensitive characteristic is ever considered (I30).

### Consent, preferences & suppression (I31–I33)

Three independent opt-ins per customer (`marketing_email_opt_in`/
`_whatsapp_opt_in`/`_sms_opt_in`), **all default `false`** — never
inferred from placing an order. The global `email_unsubscribes` list is
checked again at send time regardless of the per-business flag (the
absolute floor, I32). Re-ordering after unsubscribing never
re-subscribes a customer — nothing in the order-creation path touches
these preference columns at all, only explicit preference changes
(`PATCH /api/crm/customers/[id]`) do. Marketing eligibility
(`lib/crm/campaigns.ts`'s `getEligibleAudience()`) is recomputed at
confirm/send time, never trusted from an earlier preview (I33/I59).

### Campaign engine (I34–I38)

`campaigns`/`campaign_recipients` **extends** the existing ad-hoc
`/api/marketing/send` (untouched, still works exactly as before) rather
than replacing it — this is the segmented/scheduled/multi-channel engine
with real per-recipient delivery tracking. Flow: draft (audience +
channel + message, with an immediate estimated-recipient preview) →
confirm & send (`send_campaigns` permission, a step up from
`manage_campaigns`) → per-recipient `QUEUED`/`SENT`/`FAILED`/
`SKIPPED_SUPPRESSED`/`SKIPPED_OUT_OF_WINDOW` tracking.

**Idempotency (I38):** `campaign_recipients` has `UNIQUE(campaign_id,
crm_customer_id)` — queuing is safe to re-run, and a batch send only
touches rows still `QUEUED`, so a cron retry, a webhook retry, or a
double confirm-click can never send the same recipient twice. Large
audiences are processed in capped batches (500 per call) — re-confirming
processes the next batch, documented as a scale limitation rather than
building a full background queue.

**Channels (I35):** email (Resend, reuses the existing sender), SMS
(Twilio, reuses `sendAutomationSms`), WhatsApp (Meta Cloud API, a new
`lib/notify/whatsapp.ts` reimplemented independently from the ordering
webhook so the two can never interfere with each other). **WhatsApp
marketing is only ever sent to a recipient within their 24-hour
session window** (computed from `whatsapp_messages`) — outside it, Meta
requires a pre-approved message template, which FoodTaxi doesn't have
configured; everyone outside the window is recorded as
`SKIPPED_OUT_OF_WINDOW`, never silently dropped or sent anyway.

**Scheduling (I37):** `scheduled_for` + a new cron evaluator
(`runScheduledCampaigns`) that calls the exact same
`confirmAndSendCampaign()` the manual button uses — one send
implementation, two triggers, so a scheduled send behaves identically to
a manual one, including the same atomic claim guarding against duplicate
sends.

### Win-back & route-customer campaigns (I39/I40)

`campaign_type: 'win_back'`/`'route_customer'` are labels on the same
campaign engine — a win-back campaign is simply one targeted at the
`lapsed` segment; a route-customer campaign is a manually-built custom
segment (e.g. filtered by van) rather than an unreliable inferred
stop relationship, per I40's explicit instruction not to infer stop
relationships from old orders. Neither sends automatically — the owner
always selects the audience and confirms.

### Closure/route-change messages (I41/I42)

Not built as a distinct feature in this pass — Phase D's van-arrival
notifications remain the only automated location messaging (I41 says
reuse it, not duplicate it), and an owner can already draft an ad-hoc
message via the general campaign flow (channel + message, segment "all"
or a van-filtered custom segment) for a closure/delay/return
announcement. A dedicated "closure notice" quick-compose UI was judged
lower priority than the core CRM/loyalty/promo work (see "Not built").

### Offers & bonus loyalty (I43/I44)

An "offer" (e.g. "10% off Friday") is simply a `promo_code` with a
`campaign_type: 'offer'` campaign announcing it — no separate offers
table. **Bonus/double-points periods were not built** — `loyalty_ledger`
already has a `PROMOTIONAL_BONUS` type ready for this, but the
time-boxed "double points" rule engine itself (start/end, eligible
scope, audit trail per I44) was judged a lower-priority addition to an
already very large phase (see "Not built").

### Feedback & reviews (I45–I48)

A public `/feedback/[orderId]` page (the order id itself is the
capability, the same pattern `/receipt/[id]` already uses) submits a
1–5 rating + optional comment into `reviews`, always
`is_published: false` — a business must explicitly publish it as a
public review (`PATCH /api/crm/reviews/[id]`), which also supports a
business-response field. An opt-in `feedback_request` automation emails
once per order, 2–6 hours after collection, classified as
operational/transactional to that specific order rather than a
marketing send (I80) — capped to once ever per order via
`feedback_requests`' `UNIQUE(order_id)`. `lib/crm/feedback.ts`'s
`getReviewSummary()` gives average rating, count, a 1–5 distribution,
and a monthly trend — factual only, never an interpretation of a small
sample (I48).

### Retention analytics & cohorts (I49/I50)

`lib/crm/retention.ts` defines every metric precisely once: NEW (first
order in the period), RETURNING (ordered in the period, had ordered
before it), repeat purchase rate (2+ orders ÷ all customers, all-time),
"reordered within X days" (only counts customers whose first order is
already X days old, so nobody is miscounted as churned before they've
had time to return), and month-of-first-order cohorts with their 30-day
reorder rate. The dashboard, export-equivalent AI tool, and retention
endpoint all call these same functions.

### Customer value (I51)

`recorded_spend` is always the historical, factual total (net of
refunds) — never called "profit" or "value" beyond what it factually is.
No predictive LTV was built in this phase.

### Campaign performance & attribution (I52/I53)

Delivery is tracked per recipient (sent/failed/skipped); "opened"/
"clicked" tracking was **not** built (would need Resend webhook
integration — out of scope for this pass, documented). Promo redemption
is the one strong attribution signal (`promo_redemptions` links an order
directly to a code) — the AI system prompt (rule 12) requires
distinguishing "attributed via promo code" from "ordered after a
campaign" (a correlation, never claimed as proof of causation).

### CRM dashboard (I54)

`/dashboard/customers` → Overview: active/new/returning/lapsed
customers, repeat rate, loyalty members, rewards redeemed, average
rating, and recent campaigns — all from the same `lib/crm/*` functions
the AI tools and other tabs use.

### FoodTaxi AI CRM tools & campaign drafting (I55–I60)

`lib/ai/tools/crm.ts` — nine tools, registered into `ALL_TOOLS`:
`get_customer_growth_summary`, `get_lapsed_customer_count`,
`get_customer_segment_summary`, `get_reorder_rate`,
`get_loyalty_summary`, `get_promo_performance`, `get_review_summary`,
`get_campaign_performance`, plus one write-capable tool,
`propose_campaign`. Every read tool returns **aggregates and counts
only** — no tool exposes a customer list, name, phone, or email (I60).
`propose_campaign` follows the exact same two-step safety pattern as
every other `propose_*` tool: it creates a `PENDING`
`ai_pending_actions` row (`create_campaign_draft`), and even confirming
that only creates a **DRAFT** campaign — sending it is a second, entirely
separate, explicit "Confirm & Send" action in the dashboard (I59). The
assistant's system prompt (rule 12) requires segments to always be one
of the fixed deterministic list, forbids inferring or targeting by any
sensitive personal characteristic even if asked, and forbids claiming a
campaign was sent.

### Privacy, data minimisation & deletion foundation (I61–I63)

Phase I deliberately stores the minimum: no address, no full date of
birth (only an optional `MM-DD` `birthday_month_day`, never required,
removable, only used if a business configures a birthday feature that
this phase does not yet build), no free-text profiling beyond
business-defined tags. `crm_customers.merged_into_id` already
demonstrates the "keep for audit, mark rather than destroy" pattern this
phase uses throughout (loyalty ledger entries and campaign records are
similarly never deleted). A full customer data export/anonymisation
tool was **not** built — the architecture (one `crm_customers` row per
identity, referenced by ledger/voucher/campaign tables via foreign key)
makes a future "anonymise this identity" operation straightforward
(null out `display_name`/`email`/`normalized_phone`, keep the
now-anonymous row and its financial/audit trail intact), but the tool
itself is future work, documented rather than guessed at with an
invented retention period (I61/I63 — no legal retention period is
invented here).

### Fraud/abuse foundation (I65) & rate limiting (I64)

Race-condition protection for promo/voucher redemption is real (the
`SECURITY DEFINER` functions' row locks, above). Basic pattern
detection — repeated self-referral, duplicate reward attempts for the
same order — is prevented structurally (`UNIQUE` constraints on
`qualifying_order_id`, identity comparison for self-referral) rather
than via a separate "fraud flag" system. **Rate limiting on
promo-validation/customer-search/campaign endpoints was not added** —
they inherit the same per-request authentication every other Phase
C–H API route already requires, but no additional throttle was built
in this pass (see "Not built").

### Audit trail (I66)

No new table — every meaningful CRM action (loyalty adjustment,
redemption, promo created/changed, voucher issued, referral reward,
customer merge, marketing-preference change, campaign created/
scheduled/sent/cancelled) is logged via the existing `logAuditEvent()`
(Phase C), the same mechanism Phase D/H already use. Profile views are
never audited (I66's explicit instruction).

### Staff permissions & Van Manager scope (I67/I68)

Eleven new granular permissions (`view_customers`,
`view_customer_contact`, `manage_customer_notes`, `manage_loyalty`,
`adjust_loyalty`, `manage_promotions`, `manage_campaigns`,
`send_campaigns`, `view_marketing_analytics`, `manage_reviews`,
`manage_crm_settings`). `BUSINESS_ADMIN` gets full CRM access;
`VAN_MANAGER` gets enough to look up a customer and run POS loyalty
day-to-day, not to adjust balances by hand or manage/send bulk
marketing; `DRIVER`/`STAFF` get only `manage_loyalty` (POS
lookup/redemption), never the customer list or contact data — "ordinary
staff should not automatically access the full customer database" (I67)
applied literally. Van-restricted staff's existing van-assignment
scoping (`assertVanAllowed`/`allowedVanIds`) is unchanged and reused
wherever a tool/route takes a van filter (I68).

### Finance, stock, route & Business Memory integration (I73–I77)

Promo/voucher/loyalty discounts flow into `orders.discount_amount`
(Phase B) exactly as a menu deal already does — Phase H's finance
reports read `orders.total`/`discount_amount` unchanged, so discounted
sales are already correctly reflected; no separate "reward expense" is
recorded (I73 — reward value is a foregone-revenue discount, not a
double-counted cost). A reward-redeemed order still goes through
`deductStockForOrder()` exactly like any other order — stock is deducted
from the *items actually fulfilled*, never skipped because the
customer paid less (I74). Phase B/G's existing revenue definitions
(`sum(total)` excluding cancelled) are entirely unchanged by discounts —
`total` already reflects the discount, so analytics simply see the
correct net figure automatically (I75). Route/van-level CRM insight
(I76) is available by combining a custom segment filtered by van with
Phase G's own route analytics — no new coupling was added into
`route_sessions`/`route_session_stops`. Business Memory (Phase F) was
deliberately **not** used to store customer personal profiles or notes —
CRM data stays in its own structured tables, retrieved via the CRM
tools/API, never dumped into general semantic search (I77).

### Automation integration (I78)

Reuses Phase D's engine exactly. New types: `promo_expiring` (3-day
threshold, same exact-day pattern as Phase D's vehicle reminders),
`feedback_request` (see above, opt-in, default off). The existing
`marketing_suggestion` automation (Phase D) **is** I78's "lapsed-customer
audience ready" — rather than adding a competing automation, it was
fixed during this phase to use the same `computeSegmentMembership`
lapsed definition every other CRM surface uses (previously it had its
own bespoke van-by-van email-diff calculation) and now links to
`/dashboard/customers` instead of the old marketing page; its recipient
permission also tightened from `view_analytics` to
`view_marketing_analytics`, consistent with I67. `runScheduledCampaigns`
executes due scheduled campaigns every cron tick. "Reward unlocked"
customer-facing notifications and birthday/occasion automations were
**not** built in this pass (see "Not built").

### Birthday/occasion data (I79)

`crm_customers.birthday_month_day` exists as an optional, voluntary,
removable field (never a full date of birth, never inferred age) — but
no birthday-reward automation was built to use it yet; the column is a
foundation for that future feature, not a working feature itself.

### Transactional vs marketing (I80)

Order-status messages (Phase B/D, unchanged) remain transactional and
are never gated by the new marketing opt-in columns. The new
`feedback_request` automation is treated the same way — tied to a
specific order, sent regardless of marketing opt-in, capped to once per
order. Only campaign sends (`campaigns`/`campaign_recipients`) are
gated by the marketing preference + global unsubscribe checks.

### Not built in Phase I (see the completion report for the full list)

- WhatsApp loyalty balance display within the ordering AI flow
- A self-service customer-facing referral portal (staff-generated codes only)
- A "quick reorder" UI shortcut
- A dedicated closure/route-change quick-compose UI (the general campaign flow already covers this)
- Bonus/double-points time-boxed rule engine (the ledger type exists; the rule engine does not)
- Campaign email open/click tracking
- Additional rate limiting beyond standard per-request authentication
- A full customer data export/anonymisation tool (architecture supports it; the tool itself is future work)
- Birthday-reward automation (the data field exists; the automation does not)
- Reward-unlocked customer-facing notifications

## 70. Customer Ordering Experience, PWA, Push Notifications & Digital Menu Experience (Phase J)

### J1 audit findings (summary)

- No PWA artifacts existed at all: no `manifest.json`, no service worker, no icons, no `public/` directory.
- No push-notification infrastructure existed at all: no `web-push` package, no VAPID keys, no subscription table. The only precedent was `components/orders/NewOrderWatcher.tsx`, a foreground-only, staff-side use of the plain `Notification` API — not real background push.
- `customers` (id, user_id → users.id) already existed but was essentially dead: nothing ever inserted a row into it, and `customer_favourite_vans` (keyed on `customers.id`) had no reader or writer anywhere. Phase J reuses `customers` as the one authenticated-customer identity (lazily created on first use — `lib/customer/identity.ts`) rather than inventing a second "customer account" table. This also meant `customer_favourite_vans` and the pre-existing `orders.customer_id` FK (already nullable since Phase C's POS migration) could be used exactly as originally designed.
- Guest orders (the dominant path) never set `orders.customer_id` and have no cross-visit browser identity at all — no cookie, no localStorage token. This is unchanged for anonymous guests; a real (free) sign-in is required for favourites/history/reorder, consistent with "do not force account creation for ordinary guest ordering."
- `/van/[slug]/page.tsx` was a single 591-line client component containing menu, cart and checkout inline, with no search, no allergen display, no item images (despite both fields existing on `menu_items`), and no SEO metadata (it was 100% client-rendered).
- `components/map/LiveVanTracker.tsx` already had a 90-second GPS staleness threshold and a clear live/last-known UI split — J31/J32 were already substantially satisfied and were left alone rather than re-implemented.
- `app/api/van-profile/[slug]/route.ts` already filtered `menu_items` to `available = true` only — sold-out items were already invisible to customers on page load. The real gap was a checkout-time race: the guest order API never re-validated price or availability at submission, and never enforced `vans.accepts_online_orders` at all — both fixed in this phase (see "Server-side order revalidation" below).
- `menu_deals`/`menu_deal_items` (a pre-existing "X for £Y" bundle table, Phase B era) was never surfaced to customers anywhere — now shown on both the van page and the menu board.
- `qr_codes` supported exactly one QR per van, pointing at `/van/[slug]`; no contextual (stop/board) QR existed.
- Phase I's own audit had already found and fixed the POS stock-deduction regression; nothing further was found wrong with Phase I in this audit.

### PWA architecture (J2–J6)

- `public/manifest.json` — standalone display, orange/dark theme colours, icons at 192/512 (`any`) and a 512 maskable variant (`public/icons/`), generated by a small pure-Python PNG encoder (no ImageMagick/PIL available in this environment) rather than committed placeholder assets.
- `public/sw.js` — a hand-written, deliberately conservative service worker (no `next-pwa`/workbox — the codebase already had zero PWA tooling and this avoids taking on an extra dependency for a fairly small surface). See "Service worker / cache policy" below.
- `public/offline.html` — a fully static, dependency-free fallback page (no Next.js chunks), so it renders even if nothing else is cached.
- `components/pwa/PwaShell.tsx` — mounted once in `app/layout.tsx` (the single root layout shared by every route, including the dashboard). It is the one gate that keeps PWA behaviour customer-only: it registers the service worker and shows the install prompt only on paths that don't start with `/dashboard`, `/admin` or `/business`.
- Install prompt: listens for `beforeinstallprompt`, shows a small dismissible banner, remembers a dismissal for 14 days in `localStorage` (never re-nags every page load), and is skipped entirely if the app is already running standalone.
- Safe update strategy: the service worker calls `skipWaiting()`/`clients.claim()` and clears old versioned caches on activate; since no page HTML is ever cached (see below), a new deploy is visible on next navigation without any special update-prompt UI being necessary.

### Cache policy / service worker safety (J3/J4)

- The service worker is registered only from customer-safe paths (`PwaShell`), but also defends itself: it never intercepts `/dashboard`, `/admin`, `/business`, or **any** `/api/*` request, and never intercepts a non-GET request, regardless of where it's registered from.
- Only two kinds of things are ever cached: (1) the static offline page, manifest and icons, and (2) Next.js's own content-hashed `/_next/static/*` build assets (cache-first is safe there — a new deploy always ships new filenames, so this can never serve stale application code).
- No page HTML is ever cached. Prices, stock, order totals, loyalty balances, promo eligibility and route status all flow through `/api/*`, which is never touched by the worker — the server remains authoritative for all of it, always fetched live.
- Page navigations are network-first with no cache fallback except the static offline page on genuine network failure.

### Offline experience (J5)

- Offline behaviour is deliberately minimal and honest: if the network is unreachable during a page navigation, the static `offline.html` is shown, explicitly stating a connection is needed and that "nothing here is out of date, it just isn't loaded yet."
- There is no offline order queue and no "submit now, sync later" behaviour — `placeOrder()` in `VanProfileClient` only ever shows success after a real `2xx` from `/api/orders/guest`; a failed `fetch` surfaces as a plain error, never as a false "order placed."

### Customer account hub (J7)

- `/account` (rewritten): a server component guard (`redirect('/login?next=/account')` if signed out) rendering `components/account/AccountHub.tsx`, a tabbed client hub — Overview, Orders, Favourites, Wallet, Notifications, Profile.
- Ordinary guest ordering is completely untouched and still requires no account.

### Guest → account continuity (J8)

- Two mechanisms, both conservative and email-exact-match only, never name-based:
  1. **Going forward:** if a browser placing a "guest" checkout has an active signed-in session, `app/api/orders/guest/route.ts` now silently attaches `orders.customer_id` at creation time (best-effort, never blocks guest checkout on failure).
  2. **Retroactively:** `/api/customer/me` runs `claimGuestOrdersByEmail()` on every account-hub load — `UPDATE orders SET customer_id = :mine WHERE customer_id IS NULL AND lower(guest_email) = lower(:myVerifiedEmail)`. Exact, case-insensitive match only; never phone (unverified), never name/fuzzy similarity.
  3. The same pattern links pre-existing `crm_customers` rows (Phase I) to the account by verified email, so loyalty/vouchers/referrals a business already tracked under that email surface immediately (`/api/customer/preferences`, `/api/customer/wallet`).

### Customer authentication (J9)

- Reuses the existing shared Supabase Auth login/register system — no new auth system. Added a magic-link option to the existing `/login` page (`supabase.auth.signInWithOtp`), fully separate from the existing password form so it cannot regress it.
- `app/auth/callback/route.ts` (pre-existing, generic OAuth/magic-link/email-confirmation handler) was extended to lazily provision a `users` row with `role: 'customer'` the first time a magic-link signer has no profile row yet (mirrors what `/api/auth/register` already does for password signup) — never overwrites an existing role.

### Current order experience (J10)

- `AccountHub`'s Overview tab surfaces the most recent order with a status in `pending/accepted/preparing/ready` as a prominent card linking to `/order/[id]` (existing page, untouched polling-based order status).

### Order history / reorder (J11/J12)

- `GET /api/customer/orders` — strictly `orders.customer_id = mine`, never derived from a guessable id.
- `GET /api/customer/orders/[id]` — ownership-checked detail (order must belong to the caller), used for receipts/reorder linking.
- `GET /api/customer/orders/[id]/reorder` — computes a diff (removed/price-changed) against **current** `menu_items` for that order's items; it never itself places an order or decides prices. `VanProfileClient` reads `?reorder=<id>` from the URL, fetches this diff, and pre-fills the cart **only from items already present in its own live menu fetch** (never from the reorder endpoint's own price) — the diff is shown as a banner in checkout before the customer confirms anything.

### Favourites (J13/J14/J15)

- Vans: reuses `customer_favourite_vans` exactly as originally designed (previously unused).
- Items: new `customer_favourite_items` (customer_id, menu_item_id), cascade-deleted if the item is removed — a removed item's favourite never lingers as something orderable.
- Stops: new `customer_favourite_stops`, keyed on `van_schedule.id` (Phase G's own canonical "stop template" identity), never on free-text `pickup_location`.
- All three: heart-icon toggles on the van page and a dedicated Favourites tab in the account hub; favouriting never subscribes to marketing.

### Customer home / personalisation (J16)

- Overview tab composes: active order, loyalty balance (if any), quick links to search/favourites — all deterministic, drawn from the customer's own real data, no hidden scoring/profiling.

### Digital menu improvements (J17/J18/J21/J22)

- `VanProfileClient` (the van page, extracted from the old inline page into `components/van/VanProfileClient.tsx` with a new thin server `page.tsx` wrapper for `generateMetadata`) adds: a deterministic client-side search box (name/description/category — J18, no AI call), a price filter (Under £5/£10/£15/All — J53/J54, plain filtering, no AI), allergen chips read from `menu_items.allergens` with an explicit "Allergen info not provided" fallback when empty (J21 — never invented), and item images via a plain lazy-loaded `<img>` (not `next/image`, since business-supplied image URLs can be on any host and `next/image` requires a pre-allowlisted domain list).
- **Dietary labels (J22) were not built** — no `vegetarian`/`vegan`/`gluten_free`-style field exists anywhere in the schema. Inferring one from an item's name/description would violate J22's own explicit instruction ("do not infer... from item names"), so this is correctly left undone pending a real data field, not faked.

### Availability / sold-out (J19/J20)

- The existing design (unavailable items never returned by `/api/van-profile/[slug]`) is kept as the sold-out mechanism — simpler and safer than a visible "SOLD OUT" badge, and already correct.
- **Real gap found and fixed:** `app/api/orders/guest/route.ts` previously trusted the client's cart entirely for both availability and price, with zero server-side re-check. It now re-fetches current `menu_items` for every cart line at submission time; if any item is unavailable or its price has changed, the request is rejected with `409` and a `correction` array describing exactly what changed, and `subtotal`/`total` are recomputed server-side from the confirmed current prices (never trusted from the client) before a discount code is even considered. `VanProfileClient`'s `placeOrder()` handles this `409` by clearing the affected cart lines and showing a clear message — J20's "clear correction flow."
- **Also found and fixed:** `vans.accepts_online_orders` (a pre-existing toggle) had no enforcement anywhere. The guest order route now rejects with a clear `409` if it's `false`, and the van page hides the "Order Online" button behind a "🚫 Online ordering is currently closed" message when the server-derived live status says so.
- Exact stock quantities are never exposed to customers — only the existing boolean `available` flag.

### Digital menu board (J23–J26)

- `/van/[slug]/board` (new): a public, no-login, TV/monitor-oriented display. Reuses the exact same `/api/van-profile/[slug]` endpoint the ordering page uses — deliberately, so there is no second menu database (J24) and no risk of the board ever showing something the ordering page wouldn't (cost/stock/analytics/staff/admin data was never in that endpoint's response to begin with — J25).
- Realtime: subscribes to Supabase Realtime on `menu_items`, `vans` and `menu_deals` (all now in the `supabase_realtime` publication — `menu_items`/`menu_deals` were added by this phase's migration; `vans` was already there). Any event triggers a **debounced refetch of the authoritative REST endpoint** rather than trusting the realtime payload directly — RLS visibility of a row that just flipped `available = false` is not guaranteed to arrive as a clean delta to an anon subscriber, so correctness never depends on it. A 45-second fallback poll covers a realtime disconnect (J80's "realtime reconnect" scenario) regardless.
- Shows: business branding (logo/brand colours from the existing van `brand` JSON), categories/items/prices, active deals, and a client-generated QR code (via the existing `qrcode` package) linking straight to `/van/[slug]`.

### QR ordering / contextual QR (J27/J28)

- The existing per-van QR flow (`/api/vans/[vanId]/qr-code/generate` → `qr_codes` → `/api/qr/[code]` redirect) is extended, not replaced: `qr_codes` gained optional `context` (`'van'`/`'stop'`/`'board'`, default `'van'` — fully backward compatible, confirmed against the one existing caller which sends no body) and `context_id` (a `van_schedule.id`, server-validated against the target van before a stop QR can be generated).
- The redirect route branches on the stored context: `board` → `/van/[slug]/board`, `stop` → `/van/[slug]?stop=<id>`, else the existing behaviour. A stop-context QR only ever **pre-selects** that stop on the van page for convenience — the actual order still goes through the existing, unmodified server-side stop verification in `/api/orders/guest` (checks the stop belongs to that van's live `van_schedule`), so a forged/stale `?stop=` value can never place an order against an invalid stop.
- Scan analytics: the pre-existing `qr_codes.scan_count` (via `increment_qr_scan`) remains the source of truth — not duplicated into `customer_events`.

### Live van status / next stop / tracking (J29–J32)

- `lib/customer/liveStatus.ts` derives `LIVE_NOW` / `SCHEDULED_TODAY` / `NOT_TRADING` from `vans.tracking_status` and Phase G's `route_sessions`/`route_session_stops` (never fabricated from the mere existence of a schedule), plus a separate `orderingOpen` from `vans.accepts_online_orders`. Current/next stop is read from `route_session_stops` (ACTUAL arrival/departure) when an active session exists, and only falls back to the plain `van_schedule` template (labelled as SCHEDULED, never ACTUAL) otherwise.
- Composed server-side into `/api/van-profile/[slug]`'s response and rendered by `components/van/LiveStatusBadge.tsx` on the van page.
- Live tracking itself (`LiveVanTracker`) was left alone — it already had the 90-second stale/live GPS split this phase would otherwise have had to build.

### Check-in (J33)

- Left entirely alone — the existing "I'm on my way" check-in (`/order/[id]`, `POST /api/orders/[id]/checkin`, `orders.checked_in_at`) already prevents duplicate check-in spam and was already working correctly per the J1 audit.

### Web push (J35–J38)

- `web-push` (npm) + VAPID keys from environment variables only (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) — never generated or committed by this phase (see the completion report's environment-variables section).
- `push_subscriptions` (new table): one row per browser subscription, `business_id` required, optional `van_id`, optional `customer_id` (NULL = guest), optional `order_id` (set when a browser subscribes for updates on one specific order — see below). No RLS policy is granted to `anon`/`authenticated` at all — only the service-role key (used exclusively from trusted server API routes) can read or write it, which is the actual J37 "store securely" guarantee.
- `push_deliveries` (new table): `UNIQUE(subscription_id, trigger_key)` mirrors `automation_runs.trigger_key` exactly — `lib/push/send.ts` claims this row *before* sending, so a scheduler/webhook retry can never double-send (J38).
- `lib/push/send.ts` also marks a subscription `disabled_at` on a `404`/`410` from the push service (expired subscription cleanup — J35) and never sends to an already-disabled row.
- Business A can never reach Business B's customers (J37): `POST /api/push/subscribe` validates that `van_id`/`order_id` actually belong to the given `business_id` before the row is ever created, and the only two places that ever *send* push (order-ready, van-live) are the existing staff-authenticated status/tracking routes, scoped by the order/van they already operate on — there is no generic "send push to any subscription" surface exposed anywhere.

### Push preferences (J36)

- Five independent toggles per subscription: `notify_order_updates` (default **on**), `notify_favourite_van_arrival`, `notify_favourite_stop_reminder`, `notify_loyalty_reward`, `notify_marketing_offers` (all default **off** — explicit opt-in, mirroring Phase I's marketing-consent default). `PATCH /api/push/preferences` updates them, keyed by the subscription's own endpoint (the same unguessable-token trust model used for receipts/order-status elsewhere in this app). A small "Push notifications on this device" panel in the account hub's Notifications tab surfaces the marketing toggle and an unsubscribe button.

### Order status UI / realtime (J39/J40) and order-ready experience (J41)

- The order-status page (`/order/[id]`) keeps its existing 6-second poll (not switched to Supabase Realtime — see "Not built" below) but gains a "🔔 Notify me when it's ready" opt-in button, wired to `subscribeToPush({ business_id, van_id, order_id })`. `app/api/orders/[id]/status/route.ts` now sends a push, targeted **only** at subscriptions created for that specific `order_id` (never every subscriber to the van), the moment status becomes `ready` — idempotent via `push_deliveries`, so a retried status update can't double-push.
- `app/api/orders/[id]/route.ts` (the public order-status API) was extended with `van_id`/`vans.business_id` in its `select` so the push opt-in has what it needs — no new information is exposed to the page itself beyond that.

### Loyalty / rewards / referrals wallet (J43–J45)

- `lib/customer/wallet.ts` composes, live, from Phase I's own tables (`loyalty_accounts.balance`, active `vouchers` with `intended_customer_id = mine`, `referral_codes`/`referral_conversions`) — nothing is cached a second time. `GET /api/customer/wallet` surfaces this in the account hub's Wallet tab with balance, reward threshold/description, active vouchers, and a referral code with a pending/rewarded count and a Web-Share/clipboard "Share code" button. Referred customers' own private details are never exposed — only aggregate counts.

### Feedback / reviews (J46)

- Reuses the existing Phase I `/feedback/[orderId]` page unmodified; the account hub's Orders tab now links to it for any `collected` order.

### Customer discovery (J47–J51)

- Reuses the existing `/search` page (postcode/town/geolocation-based FoodTaxi + Google Places discovery map) and the van page's schedule section (public, authoritative `van_schedule` only — no route analytics/revenue) for J49's route discovery. A Web Share API button (with the browser's native share sheet, silently skipped when unsupported) was added to the van page for J50.
- **`/search` already distinguishes FoodTaxi-registered vans from Google Places results in its own marker/list rendering** (separate `isLive`/registered-business branch vs a generic Google Places branch in `VanMapPublic`) — reviewed, not modified. Its continuous `navigator.geolocation.watchPosition()` call (no explicit "why we need this" step before the native browser permission prompt) predates Phase J and was **not** changed given the regression risk of altering a 697-line, unfamiliar map component without the ability to live-test it — flagged as a J48 hardening recommendation for Phase K rather than risked here.

### Customer-facing AI boundary (J52) and optional menu assistant (J53/J54)

- Confirmed, not re-implemented: `app/api/ai/chat/route.ts` resolves business/staff context server-side from the session (`resolveAiContext`) and returns `404` for any account with no resolvable business — a pure-customer account (a `customers` row with no `staff`/`businesses` row) simply cannot reach FoodTaxi AI. Nothing in Phase J adds any customer-facing entry point to it.
- **The optional narrow customer menu assistant (J53) was deliberately deferred.** The two examples in the phase brief ("vegetarian items" — no dietary data exists to answer this safely; "under £10" — now answered deterministically by the price-filter chips; "available now" — already true by construction, unavailable items are never shown) are already covered by plain, deterministic UI (J54's own instruction: "do not spend Claude API calls on tasks simple application logic can handle"). Given that, and the added maintenance/cost/safety-boundary surface a customer-facing AI endpoint would introduce, this was judged unnecessary complexity for this phase and is documented as not built rather than forced in.

### Privacy / security (J56–J59)

- Every new customer-facing endpoint under `/api/customer/*` requires `requireCustomer()` (a real signed-in session) and scopes all reads/writes to that caller's own `customers.id` — reviewed individually in the completion report's security section.
- No dedicated rate-limiting infrastructure exists anywhere in this codebase (confirmed by search — the one precedent, `/api/ai/chat`, inlines its own per-user DB-row-count check). Building a proper distributed limiter (Redis/Upstash or equivalent) is real infrastructure work outside a safely reviewable scope for this phase, so instead: `app/api/orders/guest/route.ts` gained a conservative, self-contained DB-only guard (max 5 orders per phone+van per 2 minutes) against a runaway bot/retry loop, generous enough to never block a genuine busy-van rush. A proper rate-limiting layer for guest ordering, OTP/magic-link requests and push registration is recommended as Phase K technical debt.
- Push subscriptions are treated as sensitive, service-role-only data (see J35–J38 above).

### Accessibility (J60)

- New interactive elements carry `aria-label`s (favourite hearts, search/price-filter controls, install-prompt dialog and its dismiss button, tab list/tabs in the account hub) and keyboard-operable native `<button>`/`<input>` elements throughout (no click-only `<div>`s introduced). No automated axe/Lighthouse run was possible in this environment (no browser/live deploy available — see the completion report's test-results sections for exactly what was and wasn't verified).

### Performance (J61–J63)

- The van page's map (`LiveVanTracker`) was already dynamically imported; the menu board's QR generator (`qrcode`) is also dynamically imported so it never blocks the board's initial paint. Menu item images use a plain lazy-loaded `<img>`. No dedicated bundle-size/Core Web Vitals measurement tooling (Lighthouse CI etc.) exists in this environment — not run; see the completion report.

### SEO / share metadata (J64) and structured data (J65)

- `/van/[slug]/page.tsx` is now a server component with `generateMetadata` (title, description, Open Graph, Twitter card) built only from already-public fields (business name/description/city) — no private data. `robots.ts` (pre-existing) gained `/order`, `/receipt`, `/feedback` to its disallow list alongside the already-disallowed `/account`, `/dashboard`, `/admin`, `/api` — all per-order pages carrying personal detail, trusted only on an unguessable id, never meant to be crawled.
- **Structured data (JSON-LD) was deliberately not added** — accurate `Restaurant`/`LocalBusiness` schema would need opening-hours/rating data this platform doesn't reliably have (schedule data is per-stop arrival/departure times, not general business hours), and J65 explicitly says not to fabricate it.

### Branding (J66)

- The menu board and van page both apply the existing per-van `brand` JSON (primary/secondary/logo) only as accents (gradients, badges) — body text stays white/light-grey on the fixed dark background regardless of brand colours, so an unusual brand palette can't make the page unreadable.

### Customer error handling (J67)

- Handled: van/business not found, item sold-out/price-changed (the new `409` correction flow), ordering closed, network failure at checkout (the existing `catch` → alert path, unchanged), push unsupported/denied (explicit UI states, not silently failed). No raw stack traces are surfaced anywhere in the new code — every new API route returns a JSON `{ error }` shape.

### Analytics / funnel (J68/J69)

- New `customer_events` table (business/van-scoped, a client-generated, non-identifying `session_token` only for in-session dedupe — never a persistent identity) records `menu_view`, `cart_start`, `checkout_start`, `order_completed`, `install_prompt_shown/accepted/dismissed`, `reorder_used`, `loyalty_wallet_view`, `qr_scan`, written via `POST /api/analytics/event` (public, minimal, no PII accepted). `GET /api/analytics/funnel` (business-authenticated, RLS-enforced) composes raw counts over a window; a new, self-contained `CustomerFunnelWidget` was added to the existing `/dashboard/analytics` page (as an additional card beneath the pre-existing `AnalyticsDashboard`, not edited into it, to avoid any risk of regressing that already-large component).

### Integration boundaries confirmed (J70–J74)

- **CRM (J70):** no new preference system — `/api/customer/preferences` reads/writes the exact same `crm_customers.marketing_*_opt_in` columns Phase I already defined and that business-side campaigns already respect.
- **Finance/pricing (J71):** server is authoritative for totals end-to-end in the guest order path (see "Availability / sold-out" above); loyalty/voucher balances are always read live from Phase H/I's own authoritative tables, never duplicated.
- **Stock (J72):** only the existing `available` boolean is ever exposed; no cost/stock-quantity data was added to any customer-facing response.
- **Route Intelligence (J73):** live status/current/next stop reads only `location_name`/times from `route_sessions`/`route_session_stops`/`van_schedule` — never profitability/demand data (those queries were not touched or reused).
- **Automations (J74):** push was added as a new delivery channel invoked directly at two existing real-time trigger points (order status → `ready`, tracking → `live`) — the same pattern the codebase already used for `supabase.functions.invoke('send-notification', ...)` at the order-status change — not as a competing scheduled engine. It is not yet wired into the Phase D cron-based automations evaluators (e.g. a scheduled "promo expiring" push) — documented as not built.

### Subscription / payment (J75/J76)

- Not touched: confirmed via `git status` that no file under billing/subscriptions/Stripe was modified. £19.99/month, 3-day trial, one subscription tier, customers free — all unchanged. No Stripe Connect, no new payment provider.

### Testing (J77–J86) and technical validation (J87–J90)

See the completion report for the full, honest breakdown of what was statically verified (typecheck, production build, code-level security/ownership review) versus what could not be run in this environment (no live Supabase credentials, no browser/E2E tooling, no Lighthouse/axe) and therefore needs a human pass before shipping.

### Not built in Phase J (see the completion report for the full list)

- Dietary labels (vegetarian/vegan/gluten) — no underlying data field exists; inferring one was explicitly disallowed
- An optional customer-facing menu AI assistant (J53) — deferred, deterministic search/filter judged sufficient
- Realtime (as opposed to polling) order-status updates on `/order/[id]`
- A dedicated rate-limiting layer (Redis/Upstash or equivalent) for guest ordering / OTP / push registration
- Structured data (JSON-LD) for public van/menu pages
- Push wired into the Phase D scheduled-automations engine (e.g. a "promo expiring" push)
- Automated accessibility (axe/Lighthouse) and Core Web Vitals measurement — no tooling available in this environment
- A fix to `/search`'s continuous `watchPosition()` geolocation call (pre-existing, flagged not changed)
