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
  previously hardcoded the admin email. It checks the DB role first, falling
  back to the legacy email `sivakuna@icloud.com` — see the action item in
  §7 to confirm the DB role and eventually drop that fallback.
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

| Flow | File | Status |
|---|---|---|
| Event booking fee (£29.99, one-off, FoodTaxi's own Checkout) | `app/api/events/pay/route.ts` | ✅ **Active** — the one real, working Stripe flow, and the correct reference pattern for future billing |
| Webhook | `app/api/webhooks/stripe/route.ts` | ✅ Active for the booking fee event; other handlers wired but currently unreachable (see file comments) |
| Subscription billing | `app/api/subscriptions/route.ts` | 🟡 Built but incomplete — no Stripe price IDs configured, not called by any UI. **This is the Phase B target.** |
| Stripe Connect (marketplace) | `app/api/payments/create-intent/route.ts` | ⚠️ Inactive, unused, and contradicts the confirmed model above. Left in place per Phase A instructions; a deletion decision is for later. |

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
