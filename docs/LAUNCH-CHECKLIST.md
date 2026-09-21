# FoodTaxi Launch Checklist

Written during Phase O, for the platform owner. Each item is DONE,
MANUAL ACTION, BLOCKED, or OPTIONAL LATER — status as of this phase's
final commit.

## Code / platform (this session's own work)

- [x] **DONE** — 12 unauthenticated admin/service-role API routes found
  and fixed (Phase N).
- [x] **DONE** — business-claim trial-length/plan-name bug fixed (Phase
  O) — was silently creating no subscription row for anyone registering
  through that flow.
- [x] **DONE** — login-page debug panel and hardcoded admin-email
  redirect removed (Phase O).
- [x] **DONE** — customer-facing ETA wording corrected to not overclaim
  precision (Phase O).
- [x] **DONE** — hardcoded default admin password removed (Phase O).
- [x] **DONE** — two dead duplicate migration files archived, fixing a
  from-scratch migration-reconstruction failure (Phase O).
- [x] **DONE** — WhatsApp webhook signature verification, security
  headers, rate limiting, structured logging, `/api/health` (Phase N).
- [x] **DONE** — `type-check` and `build` both pass clean as of this
  phase's final commit.
- [ ] **MANUAL ACTION** — run `npm run lint` once in an interactive
  terminal/CI (it prompts for ESLint config in this non-interactive
  sandbox — pre-existing gap, not a regression).

## Environment / provider configuration

- [ ] **MANUAL ACTION** — confirm every environment variable in
  `docs/PHASE-O-LAUNCH-READINESS.md` §4 is set in Vercel Production with
  live (not test) values where applicable.
- [ ] **MANUAL ACTION** — set `WHATSAPP_APP_SECRET` to activate webhook
  signature enforcement (currently passes through unenforced without it).
- [ ] **MANUAL ACTION** — confirm Preview/Development environments use
  separate test-mode credentials (Stripe test keys, a non-production
  Supabase project or at minimum isolated test data) — this sandbox
  cannot verify this from code alone.
- [ ] **MANUAL ACTION** — confirm Stripe, WhatsApp (Meta), and any
  accounting integration's webhook/callback URLs are registered against
  the real production domain in each provider's own dashboard.
- [ ] **MANUAL ACTION** — apply migration `20240062_phase_n_hardening.sql`
  to the live database if not already applied.
- [ ] **MANUAL ACTION** — confirm the live Supabase project's actual
  backup/PITR tier (`docs/BACKUP-AND-RECOVERY.md` §1) and decide RPO/RTO
  targets.
- [ ] **MANUAL ACTION** — run a real restore drill against a throwaway
  Supabase project (never against production).

## Testing (requires live/staging environment — cannot be done from this sandbox)

- [ ] **MANUAL ACTION** — run the E2E flows listed in
  `docs/PHASE-O-LAUNCH-READINESS.md` §11–68 against staging, at minimum
  the representative subset: business registration → first order → POS
  sale → refund; WhatsApp order → confirmation; event request →
  application → £29.99 payment.
- [ ] **MANUAL ACTION** — run a real cross-tenant/multi-business
  isolation test against a live/staging database (create two businesses,
  attempt cross-access via UI/URL/API).
- [ ] **MANUAL ACTION** — live-verify the CSP in preview (browser
  console, every major page) before relying on it as a real protection.
- [ ] **MANUAL ACTION** — accessibility and device/browser testing — none
  was possible in this sandbox (no browser).
- [ ] **MANUAL ACTION** — a real load test, in staging only, never
  against production without explicit approval.

## Legal / policy (owner or legal review, not built here)

- [ ] **MANUAL ACTION** — confirm Privacy Policy, Terms, and any
  required cookie-consent wording are accurate and current for the
  actual production domain (`app/(public)/privacy`, `/terms` pages
  exist; content itself needs legal review, not assumed correct here).
- [ ] **MANUAL ACTION** — confirm FoodTaxi's own operator legal identity/
  contact details (company registration, VAT if applicable) are
  correctly configured wherever they're surfaced — not fabricated in
  this document.
- [ ] **MANUAL ACTION** — any marketing-consent or AI-disclosure wording
  a lawyer should sign off on before launch, if the business wants that
  review.

## Distribution

- [x] **DONE** — PWA manifest/service worker exist (Phase J).
- [ ] **MANUAL ACTION** — verify the production PWA install experience
  once live (manifest/icons resolve correctly against the real domain).
- **OPTIONAL LATER** — native app / App Store / Play Store distribution.
  No native app, TWA, or Capacitor wrapper exists today — FoodTaxi is
  PWA-only. Not building one for this launch (out of scope per this
  phase's own instruction not to redesign the platform). See
  `docs/OPERATIONS-HANDOVER.md` for a packaging checklist if this is
  pursued later.

## Support / operations

- [x] **DONE** — incident runbooks index (`docs/runbooks/README.md`,
  Phase N).
- [ ] **MANUAL ACTION** — decide who holds each role in
  `docs/OPERATIONS-HANDOVER.md` §7 (platform owner, technical contact,
  billing contact, support contact, incident decision maker) — left as
  placeholders here since this sandbox has no way to know real names.
- **OPTIONAL LATER** — a dedicated business help-centre CMS. A simpler
  quick-start document (`docs/BUSINESS-QUICK-START.md`) covers this for
  now, per this phase's instruction not to over-build.

## Commercial model — final confirmation

- [x] **DONE** — £19.99/month, first 3 days free, confirmed as the only
  business plan and the only trial length across every registration
  path (was inconsistent until this phase's fix).
- [x] **DONE** — customers remain free (no customer subscription/
  membership tier exists anywhere in the codebase).
- [x] **DONE** — £29.99 event booking fee confirmed structurally separate
  from business food revenue.
- [x] **DONE** — no new payment provider activated; Stripe Connect
  remains inactive except for the already-approved Stripe Terminal
  (Phase L-B).
