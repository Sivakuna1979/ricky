import { getCurrentContext } from '@/lib/workspace'
import { createClient } from '@/lib/supabase/server'
import { getPlan } from '@/lib/plans'

// Lightweight analytics computed from usage_events, messages and conversations.
export default async function AnalyticsPage() {
  const { workspace } = await getCurrentContext()
  if (!workspace) return null
  const supabase = await createClient()
  const plan = getPlan(workspace.plan)

  const since = new Date()
  since.setDate(since.getDate() - 30)
  const sinceIso = since.toISOString()

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [{ data: usage }, { count: monthMessages }, { count: convos }, { data: channels }] =
    await Promise.all([
      supabase
        .from('usage_events')
        .select('kind, created_at')
        .eq('workspace_id', workspace.id)
        .gte('created_at', sinceIso),
      supabase
        .from('usage_events')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id)
        .eq('kind', 'message')
        .gte('created_at', monthStart.toISOString()),
      supabase
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id),
      supabase.from('channels').select('id, name, type').eq('workspace_id', workspace.id),
    ])

  // Messages per day (last 30 days) for a simple bar chart.
  const perDay = new Map<string, number>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    perDay.set(d.toISOString().slice(0, 10), 0)
  }
  for (const e of usage ?? []) {
    if (e.kind !== 'message') continue
    const day = (e.created_at as string).slice(0, 10)
    if (perDay.has(day)) perDay.set(day, (perDay.get(day) ?? 0) + 1)
  }
  const days = [...perDay.entries()]
  const max = Math.max(1, ...days.map(([, n]) => n))
  const total30 = days.reduce((a, [, n]) => a + n, 0)

  // Per-conversation counts grouped by channel.
  const convoByChannel = new Map<string, number>()
  for (const ch of channels ?? []) convoByChannel.set(ch.id, 0)
  const { data: convoRows } = await supabase
    .from('conversations')
    .select('channel_id')
    .eq('workspace_id', workspace.id)
  for (const c of convoRows ?? []) {
    convoByChannel.set(c.channel_id, (convoByChannel.get(c.channel_id) ?? 0) + 1)
  }

  const pct = Math.min(100, Math.round(((monthMessages ?? 0) / plan.limits.monthlyMessages) * 100))

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <p className="mt-1 text-sm text-neutral-600">Activity across your agents and channels.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <div className="text-2xl font-bold">{total30}</div>
          <div className="text-sm text-neutral-600">Messages (30 days)</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold">{convos ?? 0}</div>
          <div className="text-sm text-neutral-600">Total conversations</div>
        </div>
        <div className="card">
          <div className="text-2xl font-bold">{pct}%</div>
          <div className="text-sm text-neutral-600">
            Monthly quota used ({monthMessages ?? 0} / {plan.limits.monthlyMessages})
          </div>
        </div>
      </div>

      {/* Messages per day */}
      <div className="card mt-6">
        <h2 className="mb-4 font-semibold">Messages per day</h2>
        <div className="flex h-40 items-end gap-1">
          {days.map(([day, n]) => (
            <div key={day} className="group flex flex-1 flex-col items-center justify-end">
              <div
                className="w-full rounded-t bg-brand/80"
                style={{ height: `${(n / max) * 100}%` }}
                title={`${day}: ${n}`}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-neutral-400">
          <span>{days[0]?.[0]}</span>
          <span>{days[days.length - 1]?.[0]}</span>
        </div>
      </div>

      {/* Conversations by channel */}
      <div className="card mt-6">
        <h2 className="mb-4 font-semibold">Conversations by channel</h2>
        {(channels ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500">No channels yet.</p>
        ) : (
          <div className="space-y-2">
            {(channels ?? []).map((ch) => {
              const n = convoByChannel.get(ch.id) ?? 0
              const maxC = Math.max(1, ...[...convoByChannel.values()])
              return (
                <div key={ch.id} className="flex items-center gap-3 text-sm">
                  <span className="w-40 truncate">
                    {ch.name} <span className="text-neutral-400">({ch.type})</span>
                  </span>
                  <div className="h-3 flex-1 rounded bg-neutral-100">
                    <div className="h-3 rounded bg-brand" style={{ width: `${(n / maxC) * 100}%` }} />
                  </div>
                  <span className="w-8 text-right tabular-nums">{n}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
