# FoodTaxi — Status

**Current priority (set 2026-11-15):** Get the first 10 paying food businesses in 30 days. Only build what helps win or keep customers — everything else waits (see the LATER list in the original brief).

Updated after each step. Most recent first.

---

## Step 1 — Make sure the live site is correct

**1. Vercel production branch — WORKED AROUND, real fix still pending**

thefoodtaxi.com had been serving the wrong codebase since ~Sept 30 2026 (6+ weeks):
- Vercel's configured Production Branch for the `food-taxi` project is `claude/wizardly-heisenberg-melz1`, not the branch this work happens on. That branch's deploy predates almost everything built since Phase G and shows the wrong pricing (£9.99/month "Premium" vs the real £19.99/month plan).
- Fixed two real deploy blockers: `engines.node` bumped `20.x` → `24.x` (Vercel discontinued Node 20.x builds), and the hourly cron changed to once-daily (Vercel Hobby plan limit).
- Could not find any way to change the Production Branch setting itself — not exposed by any available Vercel API tool, and not visible in the mobile dashboard (checked Settings → General and → Git, both fully scrolled). It's a very standard setting, so it's likely just hidden on mobile Safari; should be visible on a desktop browser at vercel.com → food-taxi → Settings → Git → "Production Branch".
- **Workaround in place:** manually aliased `www.thefoodtaxi.com` to the correct deployment via the Vercel API (`assign_alias`) instead of fixing the branch setting. This works, but every future deploy needs the same manual re-alias until the real setting is fixed.

**Status: live site now serves the correct app. Still waiting on you to fix the actual Production Branch setting on a desktop browser — see item 1b.**

**1b. Second bug this uncovered: Production-only secrets missing from these "preview-target" builds — STOPGAP APPLIED**

Because builds from this branch aren't flagged `target=production` internally (same root cause as above), they never got Production-scoped environment variables baked in — not just Supabase, but `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXTAUTH_SECRET` too. This is what caused the "Load failed" sign-up/login bug found during item 4's walkthrough.

- **Stopgap applied (with your approval):** added `preview` to the target scope of all 9 affected env vars, then forced a rebuild. Confirmed fixed — real Supabase health/settings responses and a real test sign-up succeeded afterward.
- **Tradeoff accepted:** this means Stripe's secret key and the Supabase service role key are now available to *any* preview build in this shared Vercel team account (many unrelated branches/apps live here).
- **To close this out:** once you fix the Production Branch setting (item 1), remove `preview` from these 9 vars' target scope again, so secrets go back to Production-only.

**2. PR #14 review — MERGED**

Re-verified fresh (lint/type-check/test [65/65]/build all green) before merging. Merged into the session branch 2026-11-15. Adds AI cost/latency logging (`ai_usage_log`, not yet applied to production — see below), a 40-case eval harness for the WhatsApp order parser, and `/admin/ai-costs`.

**3. `ai_usage_log` migration — PREPARED, NOT APPLIED**

`supabase/migrations/20240063_phase_b_ai_cost_tracking.sql` is written and merged into the branch, but `supabase db push` has not been run. Waiting on explicit approval before applying to production.

**4. Full sign-up journey test (phone) — IN PROGRESS**

Found and fixed along the way:
- Public homepage map was showing "API KEY REQUIRED" watermarked tiles (CARTO ended anonymous access) — switched to plain OpenStreetMap tiles.
- Public homepage was firing a "Not authorized" 403 toast for every visitor — a "Google Businesses" map toggle was calling a deliberately super-admin-only endpoint. Removed the toggle.
- Sign-up/login/password-reset all failing with "Load failed" — root cause was item 1b above. Confirmed fixed.

Next: resume the walkthrough — add menu, add schedule, connect Stripe, take a test order.

---

## Open items
- Vercel production branch still wrong (see item 1) — needs you on a desktop browser to fix properly.
- Once that's fixed, remove the `preview` scope stopgap from the 9 env vars (item 1b).
- `ai_usage_log` migration unapplied.
- `ANTHROPIC_API_KEY` not yet added as a GitHub Actions secret (the eval CI job no-ops without it).
- Steps 2–7 of the new priority plan not started.
