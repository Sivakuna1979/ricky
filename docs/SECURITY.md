# FoodTaxi Security

Written during Phase N (production hardening). This documents the
security model as it actually exists in the code today — every claim
below was verified by reading the code or migrations, not assumed. Where
something requires a live environment to verify (a browser, production
Supabase/Vercel), it's marked **[MANUAL VERIFICATION REQUIRED]** rather
than claimed as tested.

## 1. Authentication & session model

- Supabase Auth (email/password), cookie-based session via `@supabase/ssr`.
- `middleware.ts` → `lib/supabase/middleware.ts` is the single session
  refresh point and the primary gate for `/admin/*`, `/dashboard/*`,
  `/business/*`, `/account/*` page routes, plus the subscription-access
  gate for business dashboards. It does **not** gate `/api/*` routes —
  every API route is individually responsible for its own auth check.
- Super Admin: `lib/isSuperAdmin.ts` — the sole *authorization* check — is a
  pure `users.role = 'super_admin'` DB column lookup, no hard-coded email,
  confirmed by grep and re-confirmed in Phase O. **Correction to this
  document**: Phase N's version of this line claimed no hard-coded admin
  email existed "anywhere in the codebase," which was checked against the
  authorization boundary but not literally true — Phase O's audit found
  `app/(auth)/login/page.tsx` was comparing the signed-in email against a
  literal `sivakuna@icloud.com` string to decide whether to redirect to
  `/admin` or `/dashboard` after login. This was never an authorization
  bypass (`/admin`'s middleware gate, driven by `isSuperAdmin()`, was and
  is the only thing that actually decides who can use the admin area —
  landing on the wrong redirect target just bounces straight back), but it
  was a real hardcoded-email reference and a documentation inaccuracy.
  Fixed in Phase O: the redirect now queries `users.role` the same way
  `isSuperAdmin()` does, so no hardcoded email decides anything, not even
  a UX redirect. The one `sivakuna@icloud.com` string that remains
  (`app/api/events/admin/route.ts`) is unrelated to auth — a default
  contact-email value on FoodTaxi-sourced event rows.
- Business scoping: `lib/staffContext.ts` + `lib/permissions.ts` —
  business_id + role resolved server-side per request, never trusted from
  the client.
- Group scoping (Phase M): `lib/groups/context.ts` + `lib/groups/permissions.ts`
  — a deliberately separate, non-overlapping model. Group role is never
  Super Admin and never implies business access; business role is never
  implied by group role.

## 2. Row-Level Security (RLS)

RLS is the tenant **boundary** — it stops one business/customer/group
from ever reading or writing another's rows at the database level, even
if application code has a bug. It is not the permission model on its own:
which *actions* a signed-in staff member can take within their own
business is enforced in the API layer (`hasPermission()`), same as every
prior phase.

### RLS classification (142 tables with policies, audited this phase)

| Class | Pattern | Examples |
|---|---|---|
| **BUSINESS-SCOPED** | `business_id IN (my_business_ids()) OR business_id IN (my_staff_business_ids()) OR is_super_admin()` (or the van/`my_van_ids()` equivalent) | `orders`, `menu_items`, `stock_items`, `staff`, `payments`, `finance_documents`, `crm_customers`, and the large majority of tables in the schema |
| **GROUP-SCOPED** | `group_id IN (my_group_ids()) OR group_id IN (my_active_member_group_ids()) OR is_super_admin()` — Phase M | `business_groups`, `group_memberships`, `group_documents`, `group_menu_templates`, `group_announcements`, etc. |
| **CUSTOMER-OWNED** | `user_id = auth_user_id()` or `customer_id = ...` | `customer_favourite_vans/items/stops`, `order_items` (via parent order), `ai_conversations`/`ai_messages`/`ai_pending_actions` (Phase E — one customer/owner's own AI session) |
| **PUBLIC READ (+ scoped write)** | `USING (true)` or a status filter for SELECT, scoped write | `businesses` (approved only), `subscription_plans`, `menu_items`/`menus` (available only), `imported_businesses` (public read, super-admin write) |
| **SUPER-ADMIN ONLY** | Single `is_super_admin()` policy, no other access | `leads`, `sales_agent_messages`, `stripe_webhook_events` (service-role writes it; super-admin can read) |
| **SERVICE-ROLE ONLY (RLS enabled, zero policies)** | Every anon/authenticated request denied by default; only the service-role admin client (which bypasses RLS entirely) or a `SECURITY DEFINER` function can touch it | `payment_provider_secrets`, `accounting_secrets`, `oauth_states`, `push_subscriptions`, `push_deliveries`, and — as of this phase — `order_number_counters` |
| **SELF-OWNED (users table)** | `auth_id = auth.uid()` | `users` (read/update own row only) |
| **ADMIN-VIEW (business-context, not global)** | Business-scoped admin policy on an operational inbox | `whatsapp_messages`, `whatsapp_customer_prefs` |

Every table that exists was checked against this list; nothing was found
outside these buckets. The one schema-level gap found and fixed this
phase: `order_number_counters` had RLS *disabled* entirely (not just
zero-policy) — see `docs/foodtaxi-database.md` and migration
`20240062_phase_n_hardening.sql`.

## 3. API authorization audit — this phase's main finding

A route that uses the **service-role key** (directly, or via
`createAdminClient()`) bypasses RLS completely — the app-layer check is
the *only* thing standing between that route and every row in the table
it queries. This phase grepped every route using the service-role key
(17 files) and every route reimplementing its own `getAdmin()` Supabase
client instead of the shared `lib/supabase/server.ts` helpers (18 files,
overlapping set) and checked each one for a real `isSuperAdmin()`/session
check.

**12 routes had none**, several despite a comment explicitly claiming
"admin-only" — the comment had never been backed by an enforced check.
All twelve are now fixed, using the exact same `isSuperAdmin()` pattern
every correctly-written sibling route already used (see
`docs/FOODTAXI-TECHNICAL-BASELINE.md` §74 for the full list, or `git log`
for this phase's commit). Nothing new was invented — the fix in every
case was applying an existing, proven pattern to a route that had
skipped it.

Two routes (`app/api/vans/create`, `app/api/menu/import`) use the
anon/session client with no app-layer check, but were confirmed safe: RLS
`WITH CHECK` clauses (`vans_owner_all`, `menu_items_owner_all_by_van`)
correctly scope the insert to the caller's own business/van.

### Known, accepted design gap (not fixed this phase — a product decision, not a bug)

`app/api/places/claim` lets anyone self-register as the owner of a
business discovered via Google Places, keyed only on the business's
public Google `place_id` (not an unguessable secret token) plus a
self-chosen email/password. There's no verification that the claimant
actually controls the business's on-file phone/email/website before the
account and business row are created. This is pre-existing behaviour
from an earlier phase, not a Phase N regression, and changing it (e.g.
requiring a confirmation email/SMS to the discovered business's own
contact details before the claim completes) is an onboarding-flow change
this sandboxed session can't safely design and ship without a live
environment to test the new flow in. **Flagged here as a known gap for
the project owner to prioritise, not silently fixed.**

## 4. Mass assignment

Grepped every API route for `.update(body)` / `.update(req.body)` /
spread-into-update patterns. Two hits, both in
`app/api/events/[id]/route.ts` and `app/api/events/discover/route.ts` —
both are the *only* routes in the codebase that intentionally accept
arbitrary-field admin updates, and both are now behind the
`isSuperAdmin()` check (the `[id]` route was one of the twelve missing it
— see above; `discover` already had it). Every other route in the
codebase destructures explicit fields before writing, which was already
the established convention from every prior phase.

## 5. Webhooks

| Webhook | Signature verification |
|---|---|
| `app/api/webhooks/stripe/route.ts` | `stripe.webhooks.constructEvent()` with `STRIPE_WEBHOOK_SECRET` — pre-existing, correct. |
| `app/api/webhooks/stripe-connect/route.ts` | Same pattern, separate `STRIPE_CONNECT_WEBHOOK_SECRET` — pre-existing, correct. |
| `app/api/webhooks/whatsapp/route.ts` | **Added this phase.** HMAC-SHA256 over the raw body via `X-Hub-Signature-256`, keyed with `WHATSAPP_APP_SECRET` (the Meta App Secret — distinct from the per-channel `access_token`). Enforced only once `WHATSAPP_APP_SECRET` is set in the environment; passes through unchanged before that, so this can't silently break live WhatsApp ordering for a deployment that hasn't added the new secret yet. **Action required**: set `WHATSAPP_APP_SECRET` in Vercel (Meta App Dashboard → App Settings → Basic) to actually turn enforcement on. |
| `app/api/cron/automations/route.ts` | Not a public webhook, but the same shape — `Authorization: Bearer ${CRON_SECRET}` checked, pre-existing, correct. |

## 6. Rate limiting

`lib/rateLimit.ts` — in-memory sliding window. **Honest limitation**:
scoped to a single serverless function instance, not the whole
deployment; an attacker distributed across Vercel instances sees a higher
effective limit. It stops naive single-connection abuse (the realistic
threat for these endpoints), not a distributed attack. Applied to:

- `POST /api/orders/guest` (20/min/IP)
- `POST /api/crm/promo-codes/validate` (15/min/IP — code-guessing shape)
- `POST /api/crm/feedback` (20/min/IP)
- `POST /api/push/subscribe` (20/min/IP)

`POST /api/ai/chat` already had a correct, better pattern from Phase E —
a DB-backed per-user hourly count (`RATE_LIMIT_MESSAGES_PER_HOUR = 40`),
which is actually distributed-safe (unlike the in-memory helper) and was
left as-is.

**Not instrumented this pass** (documented, not silently skipped):
business/staff-authenticated exports, accounting sync triggers, and other
admin actions — these are already gated by auth + business scoping, so
the marginal risk without an additional rate limit is low; a
distributed rate limiter (Upstash Redis) is the real production path if
these need it later.

**[MANUAL VERIFICATION REQUIRED]**: the in-memory limiter's actual
behaviour under real concurrent Vercel invocations hasn't been observed
— this sandbox has no way to generate concurrent serverless traffic.

## 7. Security headers (`next.config.js`)

Content-Security-Policy, X-Content-Type-Options, Referrer-Policy,
X-Frame-Options, Permissions-Policy, Strict-Transport-Security — applied
via `headers()` to every route.

The CSP's `script-src` allowlist was built by grepping the codebase for
every external origin actually loaded in the browser: `js.stripe.com`
(Stripe Terminal SDK), `unpkg.com` + `*.basemaps.cartocdn.com` (Leaflet
tiles/assets), `*.supabase.co` including `wss://` (Supabase client +
Realtime). `next/font/google` self-hosts fonts at build time, so no
`fonts.googleapis.com`/`fonts.gstatic.com` calls happen at runtime.

`'unsafe-inline'` and `'unsafe-eval'` are kept on `script-src` because
**this sandbox has no browser** to verify a stricter, nonce-based CSP
wouldn't silently break Next.js hydration or a chart/map library.
**[MANUAL VERIFICATION REQUIRED — before tightening]**: deploy to
preview, open the browser console, confirm zero CSP violation errors
across every major page (customer ordering, dashboard, POS, group
dashboard), *then* attempt removing `'unsafe-eval'` first (lower risk),
re-verify, then consider a nonce-based `script-src` to drop
`'unsafe-inline'` too. Don't attempt this without live verification —
a broken CSP fails silently (blocked scripts, no error shown to the
user) and could take down ordering without any server-side signal.

## 8. XSS / prompt injection (re-audited, not rebuilt)

Consistent with every prior phase's established convention: React's
default JSX escaping is relied on throughout (no `dangerouslySetInnerHTML`
usage found in a repo-wide grep for menu descriptions, announcements, AI
output, or marketing content). AI-generated text (chat replies, event
discovery summaries, WhatsApp auto-replies) is always rendered as plain
text/JSON, never interpolated into HTML. Documents/customer input/menu
text are treated as untrusted data passed to the model, never as
instructions that can change tool permissions — the same boundary
established in Phase E and reused unmodified by Phase M's Group AI.

## 9. Dependency / supply-chain

`npm audit` findings this phase:

- `jspdf` / `jspdf-autotable` — critical/high CVEs, **zero references**
  anywhere in the codebase (confirmed via grep) — removed outright.
- `next` — critical CVEs. Upgraded `14.2.4` → `14.2.35`, the latest
  available patch on the 14.x line. **Residual risk, not fixed this
  pass**: several CVE advisory ranges (including two critical RCE-class
  issues — unauthenticated RCE on Windows-hosted servers, unauthenticated
  RCE in Image Optimization via AVIF) extend to `<15.5.x`, meaning no fix
  exists anywhere in the Next 14 branch. A major-version jump to Next 15
  is the only real fix, and was judged out of scope for a hardening pass
  given the breaking-change risk across ~300+ route/page files in this
  app. **Recommendation**: a dedicated, separately tested Next 15
  migration project, not a line item squeezed into a hardening phase.
- Remaining transitive/dev-tooling advisories (`@typescript-eslint/parser`,
  `brace-expansion`, `browserslist`, `form-data`, `glob`, `js-yaml`,
  `minimatch`, `nanoid`, `postcss`, `baseline-browser-mapping`, `qs`) —
  lower severity, dev/build-time only in most cases; left for a routine
  `npm audit fix` pass rather than bundled into this security review.

## 10. CSRF

Session auth is cookie-based via Supabase's `@supabase/ssr`, which sets
`SameSite` cookies by default — the standard modern CSRF mitigation for
cookie-auth apps (a cross-site request simply doesn't carry the session
cookie). No custom CSRF token scheme exists or is needed given this.
State-changing API routes are POST/PATCH/DELETE only (never GET), which
is the other half of the standard mitigation (no state change from a
simple `<img>`/link-based GET CSRF).

## 11. Known issues / follow-ups for the project owner

1. Set `WHATSAPP_APP_SECRET` in Vercel to activate the new webhook
   signature enforcement (§5).
2. Live-verify the new CSP in preview before considering it a real
   protection, and consider tightening `script-src` afterward (§7).
3. The business-claim flow's identity-verification gap (§3) — a product
   decision, not urgent, but real.
4. Next.js 15 migration — separate project, not squeezed into this phase (§9).
5. If guest-order/promo-code/feedback/push-subscribe rate limiting needs
   to hold under real distributed abuse (not just single-connection
   scripted abuse), move `lib/rateLimit.ts` to Upstash Redis (§6).
