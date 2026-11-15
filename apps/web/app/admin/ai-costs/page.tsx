// @ts-nocheck
// Phase B — AI spend/latency/error visibility. Reads ai_usage_log
// (20240063_phase_b_ai_cost_tracking.sql), written by lib/ai/usageLog.ts
// from every Anthropic call site. Aggregates in JS over the last 30 days
// rather than a DB view/materialised table — fine at FoodTaxi's current AI
// call volume; revisit with a real aggregate query if this page is ever
// loading tens of thousands of rows.
import { createAdminClient } from '@/lib/supabase/server'
import { AdminShell } from '../_shared'

export const dynamic = 'force-dynamic'

const WINDOW_DAYS = 30

async function getUsage(admin: any) {
  const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString()
  const { data, error } = await admin
    .from('ai_usage_log')
    .select('feature, model, estimated_cost_usd, latency_ms, success, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5000)
  if (error) throw error
  return data ?? []
}

function aggregateBy(rows: any[], key: string) {
  const byKey = new Map<string, { calls: number; cost: number; errors: number; totalLatency: number }>()
  for (const r of rows) {
    const k = r[key] ?? 'unknown'
    const entry = byKey.get(k) ?? { calls: 0, cost: 0, errors: 0, totalLatency: 0 }
    entry.calls += 1
    entry.cost += Number(r.estimated_cost_usd) || 0
    entry.totalLatency += Number(r.latency_ms) || 0
    if (!r.success) entry.errors += 1
    byKey.set(k, entry)
  }
  return [...byKey.entries()]
    .map(([k, v]) => ({ key: k, calls: v.calls, cost: v.cost, errors: v.errors, avgLatencyMs: Math.round(v.totalLatency / v.calls) }))
    .sort((a, b) => b.cost - a.cost)
}

export default async function AdminAiCostsPage() {
  const admin = await createAdminClient()
  let rows: any[] = []
  let loadError: string | null = null
  try {
    rows = await getUsage(admin)
  } catch (e: any) {
    loadError = e?.message ?? 'Failed to load AI usage data'
  }

  const totalCost = rows.reduce((s, r) => s + (Number(r.estimated_cost_usd) || 0), 0)
  const totalCalls = rows.length
  const totalErrors = rows.filter(r => !r.success).length
  const avgLatency = totalCalls ? Math.round(rows.reduce((s, r) => s + (Number(r.latency_ms) || 0), 0) / totalCalls) : 0
  const byFeature = aggregateBy(rows, 'feature')
  const byModel = aggregateBy(rows, 'model')
  const recent = rows.slice(0, 25)

  return (
    <AdminShell active="/admin/ai-costs">
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px', color: '#fff' }}>AI Costs</h1>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', margin: '0 0 24px' }}>
        Last {WINDOW_DAYS} days · estimated spend — figures come from a hand-maintained $/token table (lib/ai/pricing.ts), not a live Anthropic invoice.
      </p>

      {loadError ? (
        <div style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 14, padding: '18px 20px', color: 'rgba(255,255,255,.7)', fontSize: 13 }}>
          Couldn't load ai_usage_log ({loadError}). If the Phase B migration (20240063_phase_b_ai_cost_tracking.sql) hasn't been applied to this database yet, that's why — nothing will show here until it is.
        </div>
      ) : totalCalls === 0 ? (
        <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '18px 20px', color: 'rgba(255,255,255,.4)', fontSize: 13 }}>
          No AI calls recorded in the last {WINDOW_DAYS} days yet.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Estimated Spend', value: `$${totalCost.toFixed(2)}`, color: '#f59e0b' },
              { label: 'Total Calls', value: totalCalls.toLocaleString(), color: '#6366f1' },
              { label: 'Avg Latency', value: `${avgLatency.toLocaleString()}ms`, color: '#10b981' },
              { label: 'Error Rate', value: `${totalCalls ? ((totalErrors / totalCalls) * 100).toFixed(1) : '0.0'}%`, color: totalErrors ? '#ef4444' : 'rgba(255,255,255,.5)' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 6 }}>{label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '18px 20px' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px', color: '#fff' }}>By Feature</h2>
              {byFeature.map(f => (
                <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{f.key}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>{f.calls} calls · {f.avgLatencyMs}ms avg{f.errors ? ` · ${f.errors} errors` : ''}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>${f.cost.toFixed(3)}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '18px 20px' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px', color: '#fff' }}>By Model</h2>
              {byModel.map(m => (
                <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', fontFamily: 'monospace' }}>{m.key}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>{m.calls} calls · {m.avgLatencyMs}ms avg{m.errors ? ` · ${m.errors} errors` : ''}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24' }}>${m.cost.toFixed(3)}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: '18px 20px' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 14px', color: '#fff' }}>Recent Calls</h2>
            {recent.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.05)', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.feature}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontFamily: 'monospace', flexShrink: 0 }}>{r.model}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', flexShrink: 0, width: 60, textAlign: 'right' }}>{r.latency_ms}ms</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#fbbf24', flexShrink: 0, width: 56, textAlign: 'right' }}>${Number(r.estimated_cost_usd).toFixed(4)}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, flexShrink: 0,
                  background: r.success ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)', color: r.success ? '#10b981' : '#ef4444',
                }}>{r.success ? 'OK' : 'ERROR'}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', flexShrink: 0, width: 80, textAlign: 'right' }}>{new Date(r.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </AdminShell>
  )
}
