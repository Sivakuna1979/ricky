# FoodTaxi Incident Response Runbooks

Written during Phase N. This is the index. Individual detailed runbooks
beyond what's inlined here don't exist yet — building a full library of
scenario-specific playbooks without a live environment to validate the
exact steps against risks documenting things that don't actually work.
What's here is honest, general-purpose guidance; scenario-specific detail
should be added as real incidents happen and the actual steps that worked
get written down (the most trustworthy source for a runbook is a
postmortem, not a hypothetical).

## Severity levels

| Level | Definition | Example | Response |
|---|---|---|---|
| **SEV-1** | Core ordering is down or money is at risk platform-wide (payments failing, data corruption spreading, a security breach in progress) | Stripe webhook signature broken and rejecting all real payment confirmations; a bad migration corrupting order data; a leaked service-role key | Immediate response. Stop the bleeding first (kill switch / pause the affected integration / rotate the credential) before root-causing. |
| **SEV-2** | A significant feature is broken but core ordering/payments still work | WhatsApp ordering down; AI assistant erroring for all requests; a single business's dashboard broken | Same-day response. Core business (taking orders, taking payment) is unaffected, so there's time to diagnose properly rather than panic-fix. |
| **SEV-3** | A minor feature or a single business/customer is affected, workaround exists | One business's menu import failing; a cosmetic dashboard bug; a slow (not down) report | Normal-priority fix. |

## General incident process

1. **Confirm it's real** — check `/api/health`, Vercel's dashboard
   (deployment status, runtime errors), and Supabase's own status page
   before assuming the app is the problem.
2. **Classify severity** (table above) — this decides how urgently to
   act, not how thoroughly to investigate.
3. **Stop further damage if needed** — for SEV-1, this may mean disabling
   a Vercel Cron trigger, reverting to the previous Vercel deployment
   (instant rollback), or rotating a credential. See
   `docs/DEPLOYMENT.md` §5 for the feature-flag/kill-switch pattern —
   nothing in this codebase should ever be silently disabled in a way
   that makes `/api/health` lie about it.
4. **Diagnose** — Vercel Runtime Logs (structured `log.*()` output from
   `lib/logging.ts` where wired in — see `docs/OBSERVABILITY.md`),
   Supabase logs, the relevant `audit_logs` rows if a bad write is
   suspected.
5. **Fix** — following this repo's existing conventions (additive
   migrations only, no destructive change without explicit approval,
   never weaken RLS to make a symptom go away).
6. **Verify** — confirm the actual fix works before declaring resolved,
   not just that the error stopped appearing.
7. **Write it down** — a real postmortem for any SEV-1/SEV-2, including
   what actually worked, becomes the next real runbook entry here. This
   index intentionally stays thin until real incidents earn it real
   content.

## Security incident (a specific SEV-1 shape)

If a credential leak, unauthorized access, or data exposure is
suspected:

1. **Rotate the affected credential immediately** in Vercel's environment
   variables (per this phase's non-negotiable: no *unplanned* rotation
   outside an actual incident — this is exactly the planned exception
   that constraint carves out).
2. **Check `audit_logs`** for what the compromised credential/account
   actually did, scoped to the suspected window.
3. **Do not weaken RLS or auth checks to "make it easier to investigate"**
   — investigate with the service-role/admin access already available to
   whoever's responding, never by loosening what protects everyone else.
4. Once contained, assess what data was actually exposed and whether any
   notification obligation applies (a legal/business decision for the
   owner, not invented here).

## Backup / restore

See `docs/BACKUP-AND-RECOVERY.md` for the full restore runbook — not
duplicated here.

## Related documents

- `docs/SECURITY.md` — auth model, RLS classification, this phase's
  findings.
- `docs/OBSERVABILITY.md` — logging, health checks, monitoring.
- `docs/BACKUP-AND-RECOVERY.md` — restore procedure, backup status.
- `docs/DEPLOYMENT.md` — rollback, migrations, feature flags.
- `docs/PHASE-N-PRODUCTION-READINESS.md` — the full readiness gate.
