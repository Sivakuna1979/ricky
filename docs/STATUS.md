# FoodTaxi — Status

**Current priority (set 2026-11-15):** Get the first 10 paying food businesses in 30 days. Only build what helps win or keep customers — everything else waits (see the LATER list in the original brief).

Updated after each step. Most recent first.

---

## Step 1 — Make sure the live site is correct

**1. Vercel production branch — CONFIRMED PROBLEM, fix not yet applied**

thefoodtaxi.com has been serving the wrong codebase since ~Sept 30 2026 (6+ weeks):
- Vercel's configured Production Branch for the `food-taxi` project is `claude/wizardly-heisenberg-melz1`, not the branch this work happens on.
- That branch's last successful deploy predates almost everything built since Phase G: no WhatsApp ordering AI, no POS, no Stripe Terminal, no business ops/CRM/routes/groups, no hardening. Pricing shown there is £9.99/month "Premium" with pricing hidden ("Free beta mode") — not the real £19.99/month plan.
- The two newest attempts to update that branch's production deploy (Oct 19, Oct 20) both failed: Vercel discontinued Node 20.x for builds, now requires `engines.node: "24.x"` in `package.json`. **Our real codebase still says `"20.x"` too** — this must be fixed before any production deploy will succeed, regardless of branch.

Proposed fix (awaiting approval — not yet done):
1. Bump `apps/web/package.json` engines.node to `24.x`, verify lint/test/build.
2. Change Vercel's Production Branch setting to the up-to-date branch (or `main`, once merged).
3. Trigger and confirm a successful production deploy.
4. Verify thefoodtaxi.com serves the real app and real pricing afterward.

**Status: plan proposed, nothing changed yet. Waiting on go-ahead for the engines.node bump + the Vercel branch switch.**

**2. PR #14 review — MERGED**

Re-verified fresh (lint/type-check/test [65/65]/build all green) before merging. Merged into the session branch 2026-11-15. Adds AI cost/latency logging (`ai_usage_log`, not yet applied to production — see below), a 40-case eval harness for the WhatsApp order parser, and `/admin/ai-costs`.

**3. `ai_usage_log` migration — PREPARED, NOT APPLIED**

`supabase/migrations/20240063_phase_b_ai_cost_tracking.sql` is written and merged into the branch, but `supabase db push` has not been run. Waiting on explicit approval before applying to production.

**4. Full sign-up journey test (phone) — NOT STARTED**

Blocked behind item 1: no point testing the live site while it's serving the wrong codebase. Revisit once the branch switch is done.

---

## Open items
- Vercel production branch still wrong (see above) — **this blocks a real launch** until fixed.
- `ai_usage_log` migration unapplied.
- `ANTHROPIC_API_KEY` not yet added as a GitHub Actions secret (the eval CI job no-ops without it).
- Steps 2–7 of the new priority plan not started.
