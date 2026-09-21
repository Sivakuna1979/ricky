# Phase N — Production Readiness Gate

Every category below is marked **PASS**, **PASS WITH MANUAL ACTION**,
**BLOCKED**, or **NOT APPLICABLE**, per the phase's own instruction. A
PASS here means "verified in this sandbox by reading code/config/migrations
and running `type-check`/`build`" — never "verified against live
production," which this sandbox cannot do. Anything requiring live
infrastructure is PASS WITH MANUAL ACTION, naming exactly what the owner
still needs to do. **No item claims a live-environment result that wasn't
actually observed.**

| # | Category | Status | Notes |
|---|---|---|---|
| 1 | Architecture / trust-boundary mapping | PASS | Documented in `docs/FOODTAXI-TECHNICAL-BASELINE.md` §74 and `docs/SECURITY.md` — RLS as tenant boundary, API layer as permission enforcement, service-role client as the one thing that bypasses both (hence this phase's audit focus on it). |
| 2 | Threat review | PASS | Found and fixed 12 unauthenticated service-role-bypassing routes (§3 of `docs/SECURITY.md`) — the single largest finding of this phase. |
| 3 | Auth / session / RLS audit | PASS | Session model, Super Admin check, business/group scoping all re-read and confirmed correct. RLS classified across all 142 policied tables (`docs/SECURITY.md` §2). One schema-level gap found and fixed (`order_number_counters` RLS was disabled — migration `20240062`). |
| 3b | Automated cross-tenant isolation tests | **PASS WITH MANUAL ACTION** | No live database in this sandbox to run isolation tests against. The RLS policies themselves were read and classified (not just assumed), which is the strongest verification possible without a live DB. **Owner action**: run a real cross-tenant isolation test suite against a live/staging Supabase project before treating this as fully verified — a policy that reads correctly can still behave unexpectedly against real data/edge cases. |
| 4 | API inventory + runtime validation | PASS WITH MANUAL ACTION | Every service-role-bypassing route inventoried and checked (§3 above). Zod validation exists on a subset of routes (unchanged from before this phase — expanding it further across all ~250 routes was judged too large a change to make safely without live testing in this pass); mass-assignment swept and found clean beyond the two already-covered admin routes. |
| 5 | Rate limiting | PASS | `lib/rateLimit.ts` built and applied to the highest-risk unauthenticated endpoints (`docs/SECURITY.md` §6). Honestly documented as per-instance, not distributed. |
| 6 | Webhook / cron security | PASS | All three webhooks (Stripe ×2, WhatsApp) now signature-verified; cron endpoint already correctly secret-gated. |
| 7 | Secrets / environment classification | PASS | Names-only inventory in `docs/DEPLOYMENT.md` §3. Dev/preview/prod separation depends on live Vercel project config — flagged as manual verification. |
| 8 | Structured logging | PASS | `lib/logging.ts` built, wired into the highest-value path (WhatsApp webhook) as the reference. Not blanket-applied across every route this pass (see `docs/OBSERVABILITY.md` §1 for why). |
| 9 | Error monitoring | **PASS WITH MANUAL ACTION** | No paid SaaS forced, per the phase's own instruction. Vercel's native Runtime Logs/Errors is the provider-neutral baseline. **Owner action**: decide whether to add Sentry or similar for proactive alerting. |
| 10 | Health / readiness checks | PASS | `/api/health` built, DB-reachability only, no leakage. |
| 11 | Alerting | **PASS WITH MANUAL ACTION** | No alert rules exist yet — genuinely needs live traffic to tune without causing alert fatigue. Recommended starting set documented in `docs/OBSERVABILITY.md` §5. |
| 12 | Database review (indexes, N+1, transactions) | NOT APPLICABLE (no changes needed) | This phase added no new data-fetching code; existing atomic-claim/RPC patterns from every prior phase already satisfy this. |
| 13 | Race-condition testing | **PASS WITH MANUAL ACTION** | No live DB to actually run concurrent-write tests against. The atomic-claim pattern (UNIQUE constraints, `SECURITY DEFINER` RPCs) was designed correctly in prior phases and re-confirmed by code review this phase, not re-tested live. |
| 14 | Job reliability | PASS | `claimRun()`'s idempotency pattern re-confirmed correct on re-read; no changes needed. |
| 15 | Backup / restore documentation | PASS WITH MANUAL ACTION | `docs/BACKUP-AND-RECOVERY.md` written honestly — no invented retention/RPO/RTO. **Owner action**: confirm actual Supabase plan/backup tier, decide RPO/RTO targets. |
| 16 | Restore drill | **BLOCKED (sandbox constraint, not a code issue)** | Cannot be performed without a non-production Supabase project and DB credentials, neither available in this sandbox. Not claimed as tested. **Owner action**: run `docs/BACKUP-AND-RECOVERY.md` §3 end-to-end against a throwaway project. |
| 17 | Storage / upload / signed-URL audit | NOT APPLICABLE | No Supabase Storage usage anywhere in the codebase — re-confirmed by repo-wide grep this phase. |
| 18 | Load testing | **BLOCKED (sandbox constraint)** | No network egress to a live/staging deployment to load-test, and load-testing production was explicitly forbidden by the phase's own constraints regardless. Not attempted, not claimed. |
| 19 | Realtime / GPS / AI-cost / cache / frontend performance | NOT APPLICABLE (no changes this phase) | Carried over unchanged from Phases G/J/K; no browser available to re-benchmark. |
| 20 | Deployment / release-gate documentation | PASS | `docs/DEPLOYMENT.md` written, including the expand→compatible→backfill→switch→verify→contract pattern for future risky migrations. |
| 21 | Migration safety | PASS | This phase's one migration (`20240062`) is purely additive/restrictive (enables RLS, adds no data risk). Pattern documented for future risky changes; none needed retroactively since every past migration was additive. |
| 22 | Feature flags / kill switches | **PASS WITH MANUAL ACTION** | No flag system exists; none built this phase (judged unnecessary to build speculatively). Pattern documented in `docs/DEPLOYMENT.md` §5 for when a real need arises. Core ordering was never made flaggable, per the phase's explicit constraint. |
| 23 | Maintenance mode | NOT APPLICABLE | None exists; none built — documented reasoning in `docs/DEPLOYMENT.md` §6. |
| 24 | Incident-response runbooks | PASS | `docs/runbooks/README.md` — SEV levels, general process, security-incident-specific steps. Deliberately kept general rather than inventing untested scenario-specific detail. |
| 25 | Audit-log tamper protection | PASS (unchanged) | `audit_logs` RLS: super-admin read-only, any authenticated user can insert (pre-existing design from an earlier phase — app code is the actual writer, not end users directly). Not modified this phase; flagged for awareness in `docs/SECURITY.md`. |
| 26 | Data-retention inventory | **PASS WITH MANUAL ACTION** | No invented legal retention periods. GPS/location retention gap identified (`docs/BACKUP-AND-RECOVERY.md` §6) — no purge job exists; owner needs to decide a retention window before one can be built. |
| 27 | Customer export / deletion safety | NOT APPLICABLE | No such feature exists yet in the codebase; the integrity constraint it must respect (never corrupt finance/audit history) is documented for whenever it's built (`docs/BACKUP-AND-RECOVERY.md` §5). |
| 28 | No stored AI chain-of-thought | PASS (unchanged) | Re-confirmed: `ai_messages` stores only the final response text sent to/from the model, never reasoning/thinking content — same as every prior phase's AI work. |
| 29 | Dependency / supply-chain audit | PASS WITH MANUAL ACTION | `jspdf`/`jspdf-autotable` removed, `next` patched to latest 14.x. Residual Next.js CVEs with no 14.x fix documented as known debt (`docs/SECURITY.md` §9) — **owner decision**: schedule a dedicated Next 15 migration. Minor transitive advisories left for a routine `npm audit fix`. |
| 30 | Security headers | PASS WITH MANUAL ACTION | CSP + full header set added. `unsafe-inline`/`unsafe-eval` kept pending live browser verification (no browser in this sandbox) — **owner action** in `docs/SECURITY.md` §7. |
| 31 | CSRF review | PASS | SameSite cookie auth + state-changing routes are never GET — the standard mitigation, already in place, re-confirmed. |
| 32 | XSS audit | PASS | No `dangerouslySetInnerHTML` usage found repo-wide; AI/menu/announcement text always rendered as escaped JSX text. |
| 33 | AI prompt-injection re-testing | PASS (unchanged) | Re-confirmed the existing boundary (untrusted text never grants tool/system authority) holds for every AI surface including Phase M's Group AI, which is a fully separate code path. |
| 34 | Super Admin hardening | PASS | No hard-coded admin email anywhere in the codebase — re-confirmed by grep. Role is a DB column check (`isSuperAdmin()`), consistent everywhere. |
| 35 | Business-deletion safety | PASS | No hard-delete of `businesses` exists anywhere in the codebase (confirmed by grep) — archive/status-based disable is the only pattern in use. |
| 36 | Money / stock / loyalty integrity | NOT APPLICABLE (no changes this phase) | No financial/stock/loyalty logic touched — Phases H/I/L's existing correctness carries over unmodified. |
| 37 | UK DST / timezone testing | NOT APPLICABLE (no changes this phase) | `businesses.timezone` usage unchanged; no browser/live clock available to re-test DST transitions this phase. |
| 38 | Accessibility regression | **BLOCKED (sandbox constraint)** | No browser available to test any surface, including the new-to-recent Command Centre and group dashboard. Not claimed as tested. |
| 39 | Device / browser matrix | **BLOCKED (sandbox constraint)** | No real devices/browsers available. Not claimed as tested — explicitly required by the phase not to fabricate this. |
| 40 | Production-safe smoke suite | **PASS WITH MANUAL ACTION** | No automated smoke suite exists yet in this codebase. Designing one that provably never sends a real charge/message needs live staging credentials to build safely against — not attempted blind in this sandbox. **Owner action**: build a smoke suite against staging once preview/staging isolation (item 41) is confirmed. |
| 41 | Preview/staging isolation | **PASS WITH MANUAL ACTION** | Cannot verify from this sandbox whether preview deployments point at separate Supabase/Stripe/WhatsApp credentials from production. Flagged in `docs/DEPLOYMENT.md` §3 as a real gap to close if not already true. |
| 42 | Variable-cost-service safeguards | PASS | No invented cost forecasts anywhere in this phase's docs. Additionally *hardened* this phase: `places/nearby` and `discovery/google-places` (both call the paid Google Places API) were unauthenticated cost-abuse vectors — now gated behind Super Admin. |
| 43 | Runbooks index | PASS | `docs/runbooks/README.md` created. |
| 44 | Final security test | PASS WITH MANUAL ACTION | Static/code-review-based only, as honestly achievable in this sandbox (§3b, §13 above cover why live testing wasn't possible). |
| 45 | Final load test | BLOCKED (sandbox constraint) | See item 18. |
| 46 | Restore drill | BLOCKED (sandbox constraint) | See item 16 (duplicate of the phase's own numbering — same finding). |
| 47 | Full regression | PASS WITH MANUAL ACTION | `type-check` and `build` both pass clean after every change this phase (see below). No browser available for a real UI regression pass across every feature listed in the phase prompt — that requires a live/staging environment. |
| 48 | `type-check` | **PASS** | `npm run type-check` clean — verified after every change in this phase, not just once at the end. |
| 49 | `lint` | **PASS WITH MANUAL ACTION** | Pre-existing gap (not introduced this phase): `next lint` hangs on an interactive ESLint setup prompt in this non-interactive sandbox. **Owner action**: run it once in a real terminal/CI to answer the prompt, or add an `.eslintrc` so it never re-prompts. |
| 50 | `build` | **PASS** | `npm run build` succeeds — verified twice this phase (after the dependency/security-header changes, and after the full route-auth fix set). |
| 51 | Readiness gate (this document) | PASS | Delivered here. |
| 52 | Release blockers | **NONE** | No release-blocking security/data-integrity issue remains open as of this document. The 12 missing-auth routes found this phase were the release-blocking class of issue — all 12 are fixed and verified by `type-check`/`build`. |
| 53 | Manual actions required before/around release | See list below | |
| 54 | Environment actions required | See list below | |
| 55 | Known issues / technical debt | See `docs/SECURITY.md` §11 and §9 | |
| 56 | Recommendation for Phase O | See below | |

## Manual actions required (owner, before or around release)

1. Set `WHATSAPP_APP_SECRET` in Vercel to activate webhook signature
   enforcement.
2. Confirm the actual Supabase backup/PITR tier and decide RPO/RTO
   targets (`docs/BACKUP-AND-RECOVERY.md`).
3. Run a real restore drill against a throwaway Supabase project.
4. Confirm preview/staging deployments use separate Supabase/Stripe/
   WhatsApp credentials from production.
5. Live-verify the new CSP in preview (browser console, every major
   surface) before considering it a real protection; consider tightening
   afterward.
6. Run `npm run lint` once interactively (or add config to stop the
   prompt) to get a real lint baseline.
7. Run a real cross-tenant RLS isolation test suite against a live/
   staging database.
8. Decide a GPS/location data retention window and build the
   corresponding cleanup job.
9. Apply migration `20240062_phase_n_hardening.sql` to the project's
   Supabase database.

## Recommendation for Phase O

Given this phase's findings, two candidates stand out ahead of new
feature work:

1. **A dedicated Next.js 15 migration project** — the residual critical
   CVEs in Next 14 have no fix inside the 14.x line at all; this needs
   its own carefully-scoped, live-tested phase given the ~300+ route/page
   surface, not a rushed fold-in.
2. **Live-environment verification pass** — once real Vercel/Supabase
   access is available in whatever session picks this up next, working
   through this document's "PASS WITH MANUAL ACTION" and "BLOCKED" items
   (isolation tests, restore drill, load test, CSP verification,
   accessibility/device testing) would close out everything this
   sandbox genuinely couldn't verify.

Either is a reasonable Phase O; which one depends on the owner's
priorities, not something to decide unilaterally here.
