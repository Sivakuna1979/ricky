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

## Automation (Phase D)

### `businesses.timezone` 🟢 (column added in Phase D)
Defaults `'Europe/London'` for every existing business. Drives all Phase D scheduling — see baseline doc §31.

### `automation_settings` 🟢
One row per `(business_id, automation_type)` — on/off, per-channel toggles (`in_app`/`email`/`sms`/`whatsapp`), and free-form `config` (times, days, thresholds). A business with no row for a type gets that type's coded default (`lib/automations/types.ts`) — no backfill needed when a new automation type is added later.

### `automation_runs` 🟢
The execution log **and** the idempotency mechanism in one table — `UNIQUE(business_id, trigger_key)` is what makes every automation exactly-once (see baseline doc §28). `status` is `PENDING|RUNNING|COMPLETED|FAILED|SKIPPED`. No general write policy in RLS — only ever written by the cron/automation routes using the service-role client, same pattern as `stock_movements`.

### `notifications` 🟢 (Phase D is the first real writer)
Existed since `20240001`, RLS already correct (`user_id = auth_user_id()`), never written to before Phase D. Category/priority/action_url/business_id live in the existing `data` jsonb column — no schema change to this table.

---

## FoodTaxi AI (Phase E)

### `ai_conversations` 🟢
One row per chat thread. `business_id` + `user_id` — personal to the person who had it (same pattern as `notifications`), not shared across a business's staff. RLS: `user_id = auth_user_id()`.

### `ai_messages` 🟢
`role` (`user`/`assistant`), `content` (text), `tool_calls` (jsonb — tool name, the validated arguments actually executed, and a truncated result summary; never hidden reasoning, never a full raw tool payload). RLS via the parent conversation's `user_id`.

### `ai_pending_actions` 🟢
Server-controlled write-action proposals (currently only `create_purchase_order`). `status`: `PENDING → CONFIRMED → EXECUTED`, or `EXPIRED`/`CANCELLED`/`FAILED`. Claude can only ever create a `PENDING` row (via the `propose_purchase_order` tool); only an authenticated user's own `POST /api/ai/actions/[id]/confirm` can advance it, and that route's `UPDATE ... WHERE status = 'PENDING'` is what makes confirmation exactly-once (see baseline doc §56). RLS: `user_id = auth_user_id()`.

**No `ai_usage` or `ai_tool_runs` tables** — usage is rate-limited by counting `ai_messages` directly, and tool-call records live in `ai_messages.tool_calls` rather than a separate table, since they're one-to-one with the message that produced them.

---

## Business Memory (Phase F)

### `business_memory` 🟢
Free-text notes (`category`, `title`, `content`) plus an optional `embedding VECTOR(512)` (Voyage AI `voyage-3-lite`; `NULL` when no `VOYAGE_API_KEY` is configured — search then simply returns no results rather than erroring). `related_entity_type`/`related_entity_id` are a generic optional link — Phase G's route notes reuse this table via that link rather than creating a second notes system. RLS: same `my_business_ids() OR my_staff_business_ids() OR is_super_admin()` pattern as every Phase C/D table.

### `match_business_memory()` (function)
Cosine-similarity search, explicitly filtered by `business_id` and **not** `SECURITY DEFINER` — the table's own RLS still applies even if called directly, on top of the explicit filter. No ANN index yet (ivfflat/hnsw) — each business's note set is small and always scoped by `business_id` first.

---

## Route Intelligence (Phase G)

### `orders.pickup_stop_id` / `orders.service_date` 🟢 (columns added in Phase G)
`pickup_stop_id` is a nullable FK to `van_schedule` (`ON DELETE SET NULL`) — resolved and verified server-side on every order-creation path (POS, guest/online, WhatsApp), never trusted from the client directly. `service_date` is a plain `DATE`, safely backfilled for existing orders from `created_at::date`. `pickup_stop_id` is **not** backfilled — no historical stop attribution is ever guessed (G57).

### `route_sessions` 🟢
"What actually happened on a specific date" for a van, as distinct from `van_schedule` (the recurring template). `UNIQUE(van_id, service_date)` — one session per van per day, and the idempotency guarantee behind `startRouteSession()`. `status`: `active`/`completed`/`cancelled`. Starting a session is entirely optional — no other Phase G/A–F feature requires one to exist.

### `route_session_stops` 🟢
One row per stop visited within a session. `location_name`/`scheduled_arrival`/`scheduled_departure` are copied from `van_schedule` **at session start** (denormalised on purpose, same principle as `order_items`), so a later schedule edit never rewrites a historical session. `actual_arrival_at`/`actual_departure_at` are only ever set by an explicit manual action. `van_schedule_id` is nullable (an ad-hoc stop can still be logged).

### `demand_estimates` 🟢
One row per `(van_id, target_date, stock_item_id)` — `UNIQUE` constraint, and the reason a demand calculation is never silently redone or rewritten for a day once computed. `sample_values` (jsonb) holds the exact historical quantities the estimate was built from, for full explainability. `feedback_status`/`feedback_quantity`/`feedback_at`/`feedback_by` are appended after the fact, never overwriting `baseline_quantity`/`suggested_quantity`.

### `ai_pending_actions.action_type = 'create_stock_transfer'` 🟢 (new action type, Phase G)
No new table — reuses Phase E's `ai_pending_actions` exactly. `params` holds `{ van_id, from_location_id, to_location_id, items: [{ stock_item_id, quantity, ... }] }`. Confirming it calls Phase C's `apply_stock_movement()` RPC twice (a linked `TRANSFER_OUT`/`TRANSFER_IN` pair), identical to a manual transfer via `/api/stock/transfer`.

### `automation_settings` / `automation_runs` — new type `end_of_route_review` 🟢 (Phase G)
No schema change — `automation_type` was already free text (Phase D). Event-triggered from `endRouteSession()` rather than the hourly cron sweep; still goes through the same `claimRun()`/`UNIQUE(business_id, trigger_key)` exactly-once guarantee as every other automation.

### `business_memory` — route notes 🟢 (Phase G usage of the Phase F table)
A note added to a route stop (`PATCH /api/routes/sessions/[id]/stops/[stopId]`) is written here with `category: 'route_note'` and `related_entity_type: 'route_session_stop'` — no separate notes table was created for this.

RLS on `route_sessions`, `route_session_stops`, and `demand_estimates`: the same `my_business_ids() OR my_staff_business_ids() OR is_super_admin()` pattern as every table since Phase C.

---

## Finance (Phase H)

### `businesses.currency` 🟢 (column added in Phase H)
Defaults `'GBP'`. Architecture-only multi-currency hook — every current UI surface still hard-codes £.

### `user_role` — new enum value `'accountant'` 🟢 (Phase H)
Additive (`ALTER TYPE ... ADD VALUE IF NOT EXISTS`), the same safe pattern Phase C used for `'business_admin'`. Finance-scoped permissions only (`lib/permissions.ts`) — no operational-admin grants.

### `expenses` 🟢
`status` is `CONFIRMED`/`VOID` only — no in-between draft state lives here (an unconfirmed document extraction lives in `finance_documents` instead). `category` is a plain CHECK-constrained label list, never implying a VAT treatment. `document_id` links back to the `finance_documents` row it was confirmed from, if any.

### `finance_documents` 🟢
Receipt/invoice extraction staging (`extraction_status`: `PENDING → EXTRACTED → CONFIRMED`/`FAILED`). `extracted_data` (jsonb) holds Claude vision's structured result; `file_url` is an optional external link only — **no file is ever stored by FoodTaxi itself** (no Storage bucket exists in this app). Links forward to whichever of `expenses`/`supplier_invoices` it was confirmed into.

### `supplier_invoices` / `supplier_invoice_payments` 🟢
Header-level invoice totals (net/VAT/gross), `UNIQUE(business_id, supplier_id, invoice_number)` where a number is present. `status` (`UNPAID`/`PARTIALLY_PAID`/`PAID`) is derived from `supplier_invoice_payments`, computed at query time — never stored, so it can't drift. Optionally linked to a `purchase_orders` row for three-way PO/goods-received/invoice matching, reusing Phase C's existing `purchase_order_items` quantities — no per-line invoice items table exists.

### `refunds` 🟢
A separate factual record, never a mutation of `orders.status` — the pre-existing `order_status` enum is completely untouched. Revenue queries subtract matching refunds explicitly. `status` is currently only ever `'RECORDED'` — no real payment-provider refund integration exists.

### `cash_reconciliations` / `card_reconciliations` 🟢
One row per `(van_id, service_date)` each. Cash figures (`cash_sales_recorded`, `cash_refunds_recorded`, `recorded_cash_expenses`, `expected_cash`) are **snapshots taken at count time**, never live-recomputed later. Card reconciliation's `foodtaxi_card_recorded_total` vs a manually-entered `external_terminal_total` — `provider` is free text; nothing here is a real payment-provider integration.

### `vat_settings` 🟢
One row per business. `is_registered` defaults `false` — never assumed. `default_rate` is the single place a VAT percentage is configured.

### `finance_periods` 🟢
Optional lock/audit foundation (`locked`/`locked_by`/`locked_at`). No write route currently checks it before writing — a documented foundation, not yet enforcement.

### `customer_invoices` / `customer_invoice_items` / `customer_invoice_payments` 🟢
Professional catering/event invoices, entirely separate from `event_applications.foodtaxi_fee` (the £29.99 platform booking fee), which these tables never read or write. `UNIQUE(business_id, invoice_number)` for duplicate-safe numbering.

### `finance_account_mappings` 🟢
Provider-neutral category→external-account label only (H46–H53). No Xero/QuickBooks API is called anywhere — this table only adds a `mapped_account` column to the expenses CSV export when a mapping is set.

### `finance_review_items` 🟢
One generic queue table (`item_type` + a pointer to the flagged record) covering duplicate expenses, uncategorised expenses, missing suppliers, unknown VAT, and cash/card variances — created automatically where the underlying fact is recorded. Never auto-resolved or auto-deleted; only a person can mark an item `RESOLVED`/`DISMISSED`.

### `ai_pending_actions.action_type = 'create_expense'` 🟢 (new action type, Phase H)
No new table — reuses Phase E's `ai_pending_actions` exactly, the same pattern Phase G's `create_stock_transfer` already established. This — and nothing else — is the only finance action FoodTaxi AI can ever propose; there is no AI tool at all for a payment, a void, a refund, a VAT change, or a period lock.

### `automation_settings`/`automation_runs` — new types `invoice_due_reminder`, `finance_review_digest`, `vat_period_reminder`, `daily_finance_summary` 🟢 (Phase H)
No schema change — `automation_type` is free text (Phase D). All four reuse the existing hourly cron sweep and `claimRun()` exactly-once guarantee.

RLS on every new Phase H table: the same `my_business_ids() OR my_staff_business_ids() OR is_super_admin()` pattern as every table since Phase C.

---

## Customer Growth, Loyalty, CRM & Retention (Phase I)

### `crm_customers` 🟢
Identity + preference table only — never a stats cache; order count/spend/dates are always computed live from `orders` (`lib/crm/profile.ts`). `identity_key` (`'phone:+447...'` or `'email:x@y.com'`) is `UNIQUE(business_id, identity_key)` — the tenant-isolation boundary preventing the same phone number merging across two businesses' CRM. `customer_id` links to an authenticated account only on an exact phone/email match. `merged_into_id` marks (never deletes) a row merged into another.

### `orders.discount_code` / `orders.referral_code_used` 🟢 (columns added in Phase I)
Nullable, reporting/attribution only — `orders.discount_amount` (Phase B) remains the one authoritative discount figure; these just record which code, if any, was used.

### `loyalty_settings` 🟢
One row per business. `enabled` defaults `false`. Both requested earning models (points-per-spend, visit-stamps) share the same `loyalty_ledger` shape.

### `loyalty_accounts` / `loyalty_ledger` 🟢
`loyalty_accounts.balance` is a cache written **only** by `apply_loyalty_transaction()` (below) — never directly. `loyalty_ledger` is the full auditable history (`EARN`/`REDEEM`/`ADJUST`/`EXPIRE`/`REFUND_REVERSAL`/`PROMOTIONAL_BONUS`); `idempotency_key` has a `UNIQUE(business_id, idempotency_key)` partial index — the actual guard against double-earning an order under retry.

### `apply_loyalty_transaction()` (function) 🟢
`SECURITY DEFINER`, `REVOKE`d from `authenticated`/`anon` — mirrors Phase C's `apply_stock_movement()` exactly: row-locks the account, applies the delta, writes the ledger row, atomically. The only writer of `loyalty_accounts.balance`.

### `promo_codes` / `promo_redemptions` 🟢
Fixed-amount/percentage, date range, min spend, redemption limits (total + per-customer), eligible vans/channels. `promo_redemptions.order_id` is `UNIQUE` — one discount code per order, ever.

### `redeem_promo_code()` (function) 🟢
`SECURITY DEFINER`, row-locks the promo and re-checks every limit inside the lock before inserting the redemption — the actual race-condition protection against over-redeeming a limited code.

### `vouchers` 🟢
A promotional/discount instrument only (no stored value, no cash-out). `source` distinguishes `manual`/`loyalty_redemption`/`referral_reward` — all three mint the same kind of row. `redeem_voucher()` (function, `SECURITY DEFINER`) is the same atomic row-lock-and-claim pattern as promo codes.

### `referral_settings` / `referral_codes` / `referral_conversions` 🟢
One referral code per customer (`UNIQUE(business_id, crm_customer_id)`). `referral_conversions.qualifying_order_id` is `UNIQUE` — a given order can only ever qualify one referral, once. Self-referral is prevented by comparing `identity_key`, never a name.

### `campaigns` / `campaign_recipients` 🟢
Extends (does not replace) the pre-existing ad-hoc `/api/marketing/send`. `campaign_recipients.UNIQUE(campaign_id, crm_customer_id)` is what makes queuing and re-sending idempotent — a cron retry, webhook retry, or double confirm-click can never send the same recipient twice. `segment_definition` (jsonb) is the deterministic filter used to build the audience, re-evaluated at send time, never trusted from an earlier preview.

### `reviews` 🟢 (Phase A table, fixed in Phase I — see baseline doc §69)
`customer_id` made nullable; `guest_name`/`guest_phone`/`guest_email`/`business_id`/`business_response`/`responded_at`/`responded_by` added. `is_published` default flipped to `false` — a review is never public until a business explicitly publishes it.

### `feedback_requests` 🟢
`UNIQUE(order_id)` — the idempotency guard behind the once-per-order feedback-request automation.

### `ai_pending_actions.action_type = 'create_campaign_draft'` 🟢 (new action type, Phase I)
No new table — reuses Phase E's `ai_pending_actions` exactly. Confirming it only creates a DRAFT campaign; sending is always a second, separate, explicit action.

### `automation_settings`/`automation_runs` — new types `promo_expiring`, `feedback_request` 🟢 (Phase I)
No schema change. The pre-existing `marketing_suggestion` type (Phase D) was reused for I78's "lapsed-customer audience ready" rather than duplicated — see baseline doc §69.

RLS on every new Phase I table: the same `my_business_ids() OR my_staff_business_ids() OR is_super_admin()` pattern as every table since Phase C.

---

## Ownership / tenant isolation summary

Every business-scoped table is reachable only via `van_id IN (my_van_ids())` or `business_id IN (my_business_ids())`, both `SECURITY DEFINER` functions resolving from the signed-in user — this is consistent and correctly applied across the schema. The exception is the three event tables reconciled in Phase A, which had no RLS at all until this migration (safe to add: nothing in the app used anon-key access to them).

**Phase C addition:** a new function, `my_staff_business_ids()`, returns businesses where the caller has an *active* `staff` row (any role). Every new Phase C table's RLS policy is `business_id IN (my_business_ids()) OR business_id IN (my_staff_business_ids()) OR is_super_admin()` — this is the tenant-isolation boundary (no business ever sees another business's rows). It is deliberately coarse: it does not itself distinguish which *role* may take which *action* — that's enforced in the API layer by `lib/permissions.ts` + `lib/staffContext.ts`, the same "RLS = tenant boundary, API = permission boundary" split already used for super-admin routes. It also does not narrow a van-restricted staff member's *visibility* of business-wide records (e.g. a driver assigned to one van can still see all shifts/vehicle records for the business, not just their own) — documented as a known simplification in the baseline doc, not a tenant-isolation gap.

## Customer Experience, PWA & Push (Phase J)

Migration: `20240057_phase_j_customer_experience.sql`. Purely additive — new tables and columns only, no destructive changes. Full architecture write-up: baseline doc §70.

### `customer_favourite_items` 🟢
`(customer_id, menu_item_id)` composite PK, `customer_id → customers(id)`. Mirrors the pre-existing `customer_favourite_vans` shape/RLS pattern exactly. Cascade-deletes with the menu item.

### `customer_favourite_stops` 🟢
`(customer_id, stop_id)` composite PK, `stop_id → van_schedule(id)` — the canonical stop-template identity Phase G already established, never a free-text location.

### `push_subscriptions` 🟢
One row per browser push subscription. `business_id` required; `van_id`, `customer_id` (NULL = guest), `order_id` (set when subscribing for one specific order's updates) all optional. Five independent notification-type toggles, `notify_order_updates` defaulting `true`, everything else (including `notify_marketing_offers`) defaulting `false`. `endpoint` is `UNIQUE`. **No RLS policy grants anon/authenticated anything** — only the service-role key (used exclusively from trusted server routes) can touch this table; that absence of a public policy is the actual security control.

### `push_deliveries` 🟢
`UNIQUE(subscription_id, trigger_key)` — the idempotency guard behind push sends, mirroring `automation_runs.trigger_key` exactly. Same RLS posture as `push_subscriptions` (service role only).

### `customer_events` 🟢
Minimal funnel-analytics table: `business_id`, `van_id`, `event_type` (a fixed `CHECK` list), and a non-identifying, client-generated `session_token` used only to dedupe within one browsing session — never a persistent identity. RLS: readable by the owning business/staff/super-admin (`customer_events_business_read`); written only via the service-role key from `POST /api/analytics/event`.

### `qr_codes` — new columns `context`, `context_id` 🟢
`context` (`'van'` default / `'stop'` / `'board'`), `context_id → van_schedule(id)`. The uniqueness constraint moved from implicit one-per-van to `UNIQUE(van_id, context, context_id)` so a van can have a main QR plus per-stop/board QRs. Fully backward compatible — the one existing caller (auto-QR on van creation) sends no body and gets `context = 'van'`, identical to prior behaviour.

### `orders` — no new columns
`orders.customer_id` (already nullable since the Phase C POS migration) and `orders.guest_email` (already indexed, Phase I) are reused as-is for guest→account linking and claiming — no schema change needed.

### `supabase_realtime` publication — added `menu_items`, `menu_deals` 🟢
Needed for the digital menu board's live-update subscription. `vans` was already in the publication (original schema). Guarded with an `IF NOT EXISTS` check against `pg_publication_tables` so re-running this migration, or either table already having been added by hand, is a safe no-op.

### `customers` / `customer_favourite_vans` — reused, unchanged schema 🟢
Both pre-existing (Phase A) and previously unused by any code. Phase J is the first thing that actually reads/writes them: `customers` rows are created lazily (`lib/customer/identity.ts`) the first time a signed-in 'customer'-role user needs one; `customer_favourite_vans` now has a real API (`/api/customer/favourites/vans`) and UI (the van page's heart icon, the account hub's Favourites tab).

RLS on every new Phase J table: the standard `my_business_ids() OR my_staff_business_ids() OR is_super_admin()` pattern for business-readable tables (`customer_events`), or the `customer_id IN (SELECT id FROM customers WHERE user_id = auth_user_id())` pattern for customer-owned tables (`customer_favourite_items`/`customer_favourite_stops`, matching the pre-existing `customer_favourite_vans` policy) — with the deliberate exception of `push_subscriptions`/`push_deliveries`, which grant no public policy at all (service-role only, see above). As with every phase since Phase C, this RLS is the tenant/ownership *boundary*; the actual per-route authorization is enforced in the API layer (`lib/customer/identity.ts`'s `requireCustomer()` for customer-owned data, the existing staff/business auth checks for business-side routes).

## Business Growth Intelligence & Command Centre (Phase K)

Migration: `20240058_phase_k_command_centre.sql`. Purely additive — new tables only, no destructive changes. Full architecture write-up: baseline doc §71. Deliberately does NOT introduce any cached/snapshot copy of transactional data (K88) — every Command Centre figure is computed live from existing tables at request time.

### `business_goals` 🟢
One active row per `(business_id, goal_type)` — `goal_type` is one of `revenue`/`wastage_ceiling_pct`/`hygiene_completion_pct`/`stockout_count_ceiling`/`repeat_customer_rate_pct`. A new goal supersedes the previous one (`is_active = false`, kept for history rather than deleted). Written only via `POST /api/command-centre/goals`, which requires `manage_business_goals` and logs an `audit_logs` row.

### `business_budgets` 🟢
One row per `(business_id, category, period_start)` — `category` is `revenue`/`stock_purchasing`/`vehicle_maintenance`/`marketing`, `period_start` the first of a calendar month. Holds only `budgeted_amount` — actual/committed/unpaid figures are always composed live from their own source tables at comparison time (`lib/commandCentre/budgets.ts`), never stored here, so nothing can double-count or drift.

### `attention_items` 🟢
The OPEN/ACKNOWLEDGED/RESOLVED/DISMISSED workflow-state layer K55–K58 needed and nothing else in the schema provided (`notifications.is_read` is a simple two-state read flag, not this lifecycle). Deliberately holds **no cached content** — no title, body, or metric value — only identity (`dedupe_key`, unique per business) and state, so it can never become a second, driftable copy of the underlying exception data. `lib/commandCentre/attention.ts`'s `reconcileAttentionItems()` is the only writer: it (re)opens a row the moment its `dedupe_key` reappears in the freshly-computed exception list, and auto-resolves any `OPEN`/`ACKNOWLEDGED` row whose key is no longer present — a `DISMISSED` row is left untouched either way, so a dismiss can never be mistaken for a real fix.

### `command_centre_saved_views` 🟢
A name plus a JSON filter bundle (e.g. `{"van_id":"...","section":"stock"}`), scoped to the business and the creating user. A simple saved-filter convenience (K53), explicitly not a BI-dashboard-builder definition — it stores parameters for the existing Command Centre views, not a new query/visualisation spec.

### Reused, unchanged schema 🟢
Every Phase K read/composition function reads directly from tables already documented elsewhere in this file: `purchase_order_items.unit_cost` (Phase C) for confirmed supplier price history — `finance_documents`'s OCR extraction is deliberately never read for this; `live_locations.recorded_at` (Phase A/D) for GPS freshness; `van_schedule`/`route_sessions`/`route_session_stops` (Phase A/G) for live/tomorrow stop status; `hygiene_logs`, `time_entries`, `vehicle_details`, `equipment`, `wastage_records`, `stock_items`/`stock_levels`, `cash_reconciliations`/`card_reconciliations`, `supplier_invoices` (Phase C/H) for exceptions; `menu_stock_components`+`stock_items.cost_price` (Phase C/H) for menu margin; `event_applications`/`event_requests` (Phase A/marketplace) for confirmed-events lookup, matched via the business owner's email since that table has no `business_id` column.

RLS on every new Phase K table: the standard `my_business_ids() OR my_staff_business_ids() OR is_super_admin()` pattern used since Phase C. As with every phase, this is the tenant *boundary* — the finer-grained van-scoping (a Van Manager only ever seeing their own assigned vans' data, even through a "business-wide" permission) is enforced in the API layer by `lib/commandCentre/context.ts`'s `resolveCommandCentreContext()`, the Phase K equivalent of `lib/staffContext.ts`'s `getStaffContext()` + `hasPermission()`.

### `lib/permissions.ts` — seven new permissions 🟢
`view_command_centre`, `view_business_intelligence`, `view_finance_intelligence`, `view_customer_intelligence`, `view_stock_intelligence`, `manage_business_goals`, `use_ai_owner_brief`. No schema change (the `PERMISSIONS`/`ROLE_PERMISSIONS` arrays in `lib/permissions.ts` are TypeScript constants, not a DB enum) — see baseline doc §71's "Permissions" section for exactly which roles get which.

## Payments, Accounting Integrations & External Connectivity (Phase L)

Migration: `20240059_phase_l_payments_integrations.sql`. Purely additive —
no existing table altered or destructively changed; every existing
payment/finance row is preserved exactly as it was. Full architecture
write-up: baseline doc §72. **No live customer card-payment provider is
connected for any business** — see the provider decision report in §72.

### `payment_provider_connections` / `payment_provider_secrets` 🟢
Per-business, per-provider (`STRIPE_TERMINAL`/`SUMUP`/`SQUARE`/`ZETTLE`/`DOJO`/`OTHER`) connection status (`DISCONNECTED`/`CONNECTED`/`ACTION_REQUIRED`/`ERROR`), non-secret fields only, `UNIQUE(business_id, provider)`. Real OAuth/API tokens live in the separate `payment_provider_secrets` table, RLS-enabled with **zero client-role policies** — only the server's own service-role client can read/write it; no API route selects it.

### `accounting_connections` / `accounting_secrets` 🟢
The same non-secret/secret split, for `XERO`/`QUICKBOOKS`. `external_org_id`/`external_org_name` hold the connected Xero tenant / QuickBooks realm identity.

### `oauth_states` 🟢
Short-lived (10-minute) CSRF state + PKCE `code_verifier` for every OAuth authorize/callback round-trip, `provider_kind` (`PAYMENT`/`ACCOUNTING`) + `provider`, one-time-use (`used_at`, claimed atomically so a state can never be replayed).

### `payment_terminals` 🟢
Provider-neutral terminal metadata: business, optional van, optional connection, provider, `provider_device_id`, label, status (`ACTIVE`/`OFFLINE`/`UNASSIGNED`/`ERROR`). No device secrets stored. Dormant until a payment provider is connected.

### `provider_transactions` 🟢
The provider-neutral payment transaction log. `status` is the full lifecycle (`CREATED/PENDING/AUTHORISED/SUCCEEDED/FAILED/CANCELLED/PARTIALLY_REFUNDED/REFUNDED`), `payment_method_type` distinguishes `CASH/CARD_RECORDED/PROVIDER_VERIFIED_CARD/ONLINE_PROVIDER/OTHER`. Idempotent by `UNIQUE(provider, provider_transaction_id)` — the sole writer, `lib/payments/transactions.ts`'s `upsertProviderTransaction()`, treats a unique-violation as "already recorded, update instead" rather than an error.

### `provider_refunds` 🟢
Provider-side refund requests — distinct from Phase H's existing manual `refunds` table (untouched), linkable via `refund_id`. `status` `PENDING/SUCCEEDED/FAILED/CANCELLED`. Idempotent by both `UNIQUE(provider, provider_refund_id)` (once a provider assigns one) and a caller-supplied `UNIQUE idempotency_key` (before one exists). The AI can only ever create a `PENDING` row (`propose_provider_refund` tool) — the confirm step is the only path that can move it further, and today always fails safely (`no_active_payment_provider`) since no provider is connected.

### `provider_webhook_events` 🟢
Shared webhook idempotency log for every external provider (payment and accounting), `UNIQUE(provider, event_id)` — the exact insert-first pattern already proven by Phase B's `stripe_webhook_events`. Stores only minimal metadata (event id/type/status), never a full raw payload.

### `accounting_account_mappings` 🟢
`UNIQUE(business_id, provider, category)` — category is one of `sales/food_stock/packaging/fuel/vehicle/repairs/equipment/marketing/professional_fees/other`, mapping to a real `external_account_id`/`external_account_name`/`tax_code`. **Not** the same table as Phase H's `finance_account_mappings` (a generic, provider-agnostic CSV-export label with no tax code and no real connection) — deliberately separate since this one is connection-bound and feeds a real sync. `tax_code` is only ever what a human typed in; never guessed.

### `accounting_sync_jobs` 🟢
The background sync queue. `status` `NOT_SYNCED/QUEUED/SYNCING/SYNCED/FAILED/NEEDS_REVIEW`, `attempts`/`next_retry_at` back exponential backoff, `UNIQUE(idempotency_key)` makes re-queueing the same underlying fact a no-op. A job failed 5 times moves to `NEEDS_REVIEW` (dead-letter) rather than retrying forever.

### `reconciliation_review_items` 🟢
Generic review queue (`category` + `reference` JSONB + `detail`), `status` `OPEN/RESOLVED/DISMISSED`. Written only by `lib/payments/reconciliation.ts`'s deterministic `runReconciliationSweep()` — never resolves anything itself, only surfaces unmatched/mismatched provider records for a human.

RLS on every new Phase L table (except the two secrets tables and `oauth_states`, which grant no client-role policy at all): the standard `my_business_ids() OR my_staff_business_ids() OR is_super_admin()` pattern used since Phase C.

### `lib/permissions.ts` — three new permissions 🟢
`view_integrations`, `manage_payment_integrations`, `manage_accounting_integrations`. No schema change (TypeScript constants, not a DB enum) — see baseline doc §72's "Permissions" section for exactly which roles get which.

## Live customer card payments — Stripe Terminal (Phase L-B)

Migration: `20240060_phase_l_stripe_terminal.sql`. One additive schema
change only.

### `order_status` — new value `awaiting_payment` 🟢
`ALTER TYPE order_status ADD VALUE`. An order sits here only while a
Stripe Terminal charge is in flight — invisible to the Kitchen Display
(`PREP_STATUSES` in `app/(business)/dashboard/kitchen/page.tsx` never
included it) and excluded from revenue (`REVENUE_EXCLUDED_STATUSES` in
`lib/finance/revenue.ts` now includes it alongside `cancelled`). Moves to
`preparing` the moment Stripe genuinely confirms payment (via the till's
own confirm call or the Connect webhook, whichever arrives first — both
guarded so it can only ever happen once), or to `cancelled` on
decline/cancel/timeout. No other column or table changed — every
`payment_provider_connections`/`provider_transactions`/`provider_refunds`/
`payment_terminals`/`provider_webhook_events` row a Stripe Terminal charge
produces uses the exact Phase L-A schema unchanged, with `provider =
'STRIPE_TERMINAL'`.
