# FoodTaxi Database Reference

Scope: `apps/web` (FoodTaxi) only. This repo's `supabase/migrations` folder also
contains schema for two unrelated products that share the same Supabase
project history — the **Agent Platform** (`20240020_agent_platform.sql`,
tables prefixed like `workspaces`) and **YouTube automation**
(`20240040`–`20240043_youtube_*.sql`). Neither is covered here and neither
should be touched by FoodTaxi work.

Status legend: 🟢 active · 🟡 partially used · ⚪ legacy/unused (not deleted)

---

## Core

### `users`
Every authenticated person — business owners, super admins. Guests (online/WhatsApp/POS customers) are **not** represented here; they live only as free-text fields on `orders`.
- Key columns: `auth_id` (FK to Supabase `auth.users`), `email`, `role` (`user_role` enum: `super_admin | business_owner | van_manager | driver | staff | customer`)
- 🟡 Only `super_admin` and `business_owner` are meaningfully used by the app today. `van_manager`/`driver`/`staff`/`customer` exist in the enum but no code branches on them.
- RLS: users manage their own row; super admin sees all.

### `businesses`
One row per FoodTaxi customer (a food-van company). Owns one or more `vans`.
- Key columns: `owner_id` → `users.id`, `name`, `slug`, `business_type`, address fields, `stripe_customer_id`, `stripe_account_id`, `food_hygiene_rating`, `companies_house_number`, `vat_number`
- 🟡 `stripe_account_id` is only meaningful for the unused Stripe Connect path (see baseline doc, Payments section) — do not confuse with the business's own subscription billing (`stripe_customer_id`, used by `subscriptions`).
- Used by: registration, dashboard, billing, discovery/claim flow.
- RLS: owner-only read/write via `my_business_ids()`; super admin all.

### `vans`
A single mobile unit under a business. Most feature tables key off `van_id`.
- Key columns: `business_id`, `name`, `slug`, `tracking_status` (`live|paused|offline`), `accepts_cash`, `accepts_card_at_van`, `category_order` (TEXT[], owner-set menu section ordering), `brand` (JSONB — AI-captured theme colours), `checked_in_at`-adjacent order features live on `orders`, not here.
- 🟢 Fully active — live tracking, menu, schedule, POS, kitchen, WhatsApp all key off this.
- RLS: owner via `my_van_ids()`; public read for active vans (customer-facing pages).

---

## Menu

### `menu_items` 🟢 (reconciled in Phase A — see migration `20240048`)
- **Active shape** (what every current feature uses): `van_id` (FK → vans), `name`, `description`, `price`, `category` (plain text), `available` (bool)
- ⚪ Legacy columns still present but unpopulated by any active code: `category_id` (FK to the table below), `image_url`, `is_available`, `is_featured`, `allergens`, `calories`, `sort_order`
- Used by: Menu manager, POS, WhatsApp ordering, menu-card AI scan/import, public van ordering page, meal deals.

### `menus`, `menu_categories`, `menu_item_options`, `menu_item_option_choices` ⚪ legacy
Original relational menu design (menu → categories → items → options/modifiers). No active route reads or writes these. `components/menu/MenuBuilder.tsx` and `components/menu/MenuItemForm.tsx` still target this shape but are **not imported by any page** — dead frontend code. Not deleted in Phase A; candidate for removal once confirmed unnecessary.

### `menu_deals` / `menu_deal_items` 🟢
Mix-and-match bundle pricing ("any 3 for £1"). `menu_deals`: `van_id`, `name`, `quantity`, `deal_price`, `active`. `menu_deal_items`: join table to `menu_items`. Applied automatically at the POS and (structurally, via the same discount field) online.

---

## Scheduling & Tracking

### `van_schedule` 🟢
The actual weekly-recurring stop schedule used everywhere (public van page, POS, checkout pickup selection, kitchen). `van_id`, `day_of_week` (0=Mon..6=Sun), `location_name`, `arrival_time`, `departure_time`, `notes`, `sort_order`.

### `van_routes` / `route_stops` ⚪ legacy
Original schedule design (`day_of_week` enum, PostGIS `location`, `stop_order`). Fully superseded by `van_schedule`. No active code references these.

### `live_locations` 🟢
GPS pings written while a van is tracking. `van_id`, `latitude`, `longitude`, `heading`, `speed`, `accuracy`, `recorded_at`. Drives the live map and "last known position" fallback.

---

## Orders

### `orders` 🟢
The single order table for every channel (online guest, WhatsApp, POS/till, and eventually event bookings use a separate table).
- Core: `order_number` (daily-reset sequence via trigger), `van_id`, `status` (`pending|accepted|preparing|ready|collected|cancelled`), `payment_method` (`card_online|cash_at_van|card_at_van`), `subtotal`, `total`, `source` (`online|guest|pos|whatsapp`)
- Guest/checkout: `guest_name`, `guest_phone`, `guest_email`, `pickup_location`, `pickup_time`
- POS extras: `cash_tendered`, `served_by` (folded into `notes`)
- Deals: `discount_amount`
- Check-in: `checked_in_at` — customer's "I'm on my way" signal, independent of order placement time
- `customer_id` → `customers.id` — **nullable** (changed in `20240033_pos_orders.sql`) since guest/POS orders have no logged-in customer
- RLS: van owner read/update via `my_van_ids()`; logged-in customer via `customer_id`; guest INSERT allowed (status must be `pending`).

### `order_items` 🟢
Line items. `order_id`, `menu_item_id`, `name`, `price`, `quantity`, `item_total`. Denormalised name/price at time of order (correct — protects historical accuracy if a menu item is later renamed/repriced).

### `payments` 🟡
Records Stripe payment attempts. Only actually populated by the **event booking fee** flow and the orphaned `/api/payments/create-intent` (see baseline doc). Not populated for cash/card-at-van POS/online sales — those are recorded directly on `orders`, not via a `payments` row.

---

## Billing

### `subscription_plans` / `subscriptions` 🟡
Seeded with three plans (Starter £29, Pro £59, Enterprise £99/mo) but `stripe_price_id_monthly/yearly` were never set, and the Billing dashboard page doesn't call the `/api/subscriptions` route at all (it shows a static "email us to upgrade" link). Structurally sound, functionally inert. This is the main Phase B target.

---

## Hygiene / Compliance 🟢
`hygiene_logs`, `temperature_logs`, `cleaning_logs`, `haccp_records`, `hygiene_documents`, `allergen_info`, `supplier_records` — all business-scoped via `business_id`, all actively used by `/dashboard/hygiene`. `supplier_records` is under-used: the Hygiene page only logs supplier *delivery checks* as free text, not a real supplier database (no code queries `supplier_records` directly — confirm before assuming it's populated).

---

## WhatsApp 🟢
`whatsapp_messages` (inbound log + `outcome`, `send_error`, `delivery_status`, `reply_wamid` — all added across Phase-A-adjacent work this project), `whatsapp_channels` (per-business or shared number config), `whatsapp_customer_prefs` (remembers which van a customer on a shared number is ordering from). Fully active — this is the AI ordering pipeline.

---

## Events / Catering 🟢 (schema formally reconciled in Phase A)
`event_requests`, `event_applications`, `event_blocked_dates` — **existed live but had no committed CREATE TABLE migration until `20240048_schema_reconciliation.sql`**. `event_messages`, `ai_event_discoveries`, `event_outreach` were already properly migrated. All admin_status/workflow logic lives in `app/api/events/**`, all using the service-role key (no direct anon/browser access to any of these tables).

---

## Growth / Ops
- `imported_businesses`, `leads`, `sales_agent_messages` 🟢 — AI-driven prospect discovery (Google Places + FSA + Companies House) and outreach, feeds the "claim your business" flow.
- `email_unsubscribes` 🟢 — marketing-email opt-out list, checked before every send.
- `reviews` 🟡 — schema + RLS exist (public read published, customer owns their own, van owner reads); no UI found for a customer to actually leave one, or for an owner to moderate one.
- `notifications` ⚪ — table exists, RLS exists, **nothing writes to it**. No push notification system is implemented (SMS via Twilio and email via Resend are the real notification channels).
- `audit_logs` ⚪ — table + RLS exist, **nothing writes to it**. See Phase A6 recommendation in the baseline doc.
- `customer_favourite_vans` ⚪ — table + RLS exist; no "favourite a van" UI found.

---

## Business Operations (Phase C)

### `staff` 🟢 (activated in Phase C — table existed since `20240001`, unused before)
`business_id`, `user_id`, `van_id` (nullable — NULL means "all vans"), `role` (`user_role` enum, now including `business_admin`), `is_active`, `invited_at`, `joined_at`. One row per assigned van (the old `UNIQUE(business_id, user_id)` was dropped in Phase C to allow this). `my_van_ids()` already UNIONed this table in from Phase A/2 — Phase C only changed it to treat a NULL `van_id` row as "all vans" instead of granting nothing.

### `stock_locations` / `stock_items` / `stock_levels` / `stock_movements` 🟢
A business's own stock catalogue (`stock_items`, no hard-coded products), locations (`stock_locations` — warehouse/van/other; a `van`-type location is 1:1 with a `vans` row), and current quantity **per location** (`stock_levels`). `stock_movements` is the append-only ledger — quantity never changes any other way than through the `apply_stock_movement()` Postgres function (service-role only), which row-locks and records `previous_quantity`/`new_quantity` atomically.

### `stocktakes` / `stocktake_items` 🟢
A stocktake snapshots `stock_levels` as `expected_quantity` at a location, staff enter `counted_quantity`, and confirming creates one `ADJUSTMENT` movement per difference — counts never silently overwrite stock.

### `menu_stock_components` 🟢
Optional per-`menu_item` recipe — links to `stock_items` with a `quantity_per_item`. No rows for a menu item = automatic deduction does nothing for it.

### `wastage_records` 🟢
Reason/quantity/cost, automatically creates a `WASTAGE` stock movement.

### `supplier_records` 🟢 (extended in Phase C, existed since `20240001`, previously unused)
Now the real supplier directory — added `website`, `account_reference`, `is_active`. Same table the Hygiene page's schema referenced but never queried.

### `supplier_products` 🟢
Supplier ↔ `stock_items` link: product code, pack size, latest cost, preferred flag.

### `purchase_orders` / `purchase_order_items` 🟢
`DRAFT → ORDERED → PARTIALLY_RECEIVED/RECEIVED`, or `CANCELLED`. Receiving increases `stock_levels` via `apply_stock_movement()` (`PURCHASE` type) and updates `supplier_products.latest_cost`.

### `shifts` / `time_entries` 🟢
Shift scheduling and clock-in/out. `time_entries.is_manual_adjustment` + `adjustment_reason` + `adjusted_by` make corrections auditable (also logged to `audit_logs`).

### `vehicle_details` 🟢
1:1 extension of `vans` (`van_id` primary key) — make/model/year/fuel/VIN/MOT/insurance/road tax/service due/mileage. Does not duplicate `vans.registration_plate`.

### `vehicle_documents` 🟢 (metadata only — see baseline doc "Known issues")
Document type + expiry date + optional external `file_url`, same convention as the pre-existing `hygiene_documents`. No file upload UI in Phase C.

### `vehicle_maintenance` / `equipment` / `equipment_maintenance` 🟢
Maintenance history per van/equipment; `equipment.next_service_date`/`warranty_expiry` feed the reminder engine.

### `orders.stock_deducted_at` / `orders.stock_restored_at` 🟢 (columns added in Phase C)
Idempotency guards for automatic stock deduction on order collection / restoration on cancellation. See baseline doc for the full rule.

### `audit_logs` 🟢 (first real writer — Phase C)
Existed since `20240001`, documented as a Phase A recommendation, never written to until Phase C's `lib/auditLog.ts`. Used for: stock adjustments, stocktake confirmation, purchase-order status changes, staff role changes, timesheet corrections, vehicle detail changes.

---

## Ownership / tenant isolation summary

Every business-scoped table is reachable only via `van_id IN (my_van_ids())` or `business_id IN (my_business_ids())`, both `SECURITY DEFINER` functions resolving from the signed-in user — this is consistent and correctly applied across the schema. The exception is the three event tables reconciled in Phase A, which had no RLS at all until this migration (safe to add: nothing in the app used anon-key access to them).

**Phase C addition:** a new function, `my_staff_business_ids()`, returns businesses where the caller has an *active* `staff` row (any role). Every new Phase C table's RLS policy is `business_id IN (my_business_ids()) OR business_id IN (my_staff_business_ids()) OR is_super_admin()` — this is the tenant-isolation boundary (no business ever sees another business's rows). It is deliberately coarse: it does not itself distinguish which *role* may take which *action* — that's enforced in the API layer by `lib/permissions.ts` + `lib/staffContext.ts`, the same "RLS = tenant boundary, API = permission boundary" split already used for super-admin routes. It also does not narrow a van-restricted staff member's *visibility* of business-wide records (e.g. a driver assigned to one van can still see all shifts/vehicle records for the business, not just their own) — documented as a known simplification in the baseline doc, not a tenant-isolation gap.
