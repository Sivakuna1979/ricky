// @ts-nocheck
// K55-K58 — reconciles the freshly-computed (always live, never cached)
// exception list against the `attention_items` workflow-state table. This
// is the ONLY writer of that table. See the migration's own comment for
// why the table holds no cached content, only identity + state.
import type { Priority } from './priority'

export type LiveIssue = {
  dedupeKey: string
  category: string
  priority: Priority
  vanId?: string | null
}

// Call this once per Command Centre load with the FULL current set of
// live-detected issues. Returns the same issues annotated with their
// workflow state, and performs the DB reconciliation as a side effect:
//   - a new dedupe_key (or one that had gone RESOLVED and reoccurred) is
//     (re)opened as OPEN
//   - an OPEN/ACKNOWLEDGED row whose dedupe_key is no longer present is
//     auto-RESOLVED ("the condition genuinely isn't detected any more" —
//     K58's real resolution, never claimed by a dismiss)
//   - a DISMISSED row is left exactly as dismissed while its condition
//     persists (K57 — dismissing never touches the underlying issue)
export async function reconcileAttentionItems(admin: any, businessId: string, liveIssues: LiveIssue[]) {
  const { data: existingRows } = await admin.from('attention_items').select('*').eq('business_id', businessId)
  const existingByKey = new Map((existingRows ?? []).map((r: any) => [r.dedupe_key, r]))
  const liveKeys = new Set(liveIssues.map((i) => i.dedupeKey))

  const toInsert: any[] = []
  const toReopen: string[] = []
  for (const issue of liveIssues) {
    const existing = existingByKey.get(issue.dedupeKey)
    if (!existing) {
      toInsert.push({
        business_id: businessId, van_id: issue.vanId ?? null, dedupe_key: issue.dedupeKey,
        category: issue.category, priority: issue.priority, state: 'OPEN',
      })
    } else if (existing.state === 'RESOLVED') {
      toReopen.push(existing.id)
    } else if (existing.priority !== issue.priority) {
      // The rule engine's own priority for this exact issue changed
      // (e.g. a low-stock warning becoming out-of-stock) — keep the
      // workflow state (don't silently un-dismiss/un-acknowledge) but
      // keep the priority label accurate.
      await admin.from('attention_items').update({ priority: issue.priority }).eq('id', existing.id)
    }
  }

  const toAutoResolve = (existingRows ?? [])
    .filter((r: any) => ['OPEN', 'ACKNOWLEDGED'].includes(r.state) && !liveKeys.has(r.dedupe_key))
    .map((r: any) => r.id)

  await Promise.all([
    toInsert.length ? admin.from('attention_items').insert(toInsert) : null,
    toReopen.length ? admin.from('attention_items').update({ state: 'OPEN', state_changed_at: new Date().toISOString(), resolved_reason: null }).in('id', toReopen) : null,
    toAutoResolve.length ? admin.from('attention_items').update({ state: 'RESOLVED', state_changed_at: new Date().toISOString(), resolved_reason: 'auto: condition no longer detected' }).in('id', toAutoResolve) : null,
  ].filter(Boolean))

  const { data: finalRows } = await admin.from('attention_items').select('id, dedupe_key, state, first_seen_at, van_id').eq('business_id', businessId).in('dedupe_key', [...liveKeys])
  const stateByKey = new Map((finalRows ?? []).map((r: any) => [r.dedupe_key, r]))

  return liveIssues
    .map((issue) => ({ ...issue, id: stateByKey.get(issue.dedupeKey)?.id ?? null, state: stateByKey.get(issue.dedupeKey)?.state ?? 'OPEN', first_seen_at: stateByKey.get(issue.dedupeKey)?.first_seen_at ?? null }))
    .filter((issue) => issue.state !== 'DISMISSED')
}
