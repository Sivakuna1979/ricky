import { createClient } from '@/lib/supabase/server'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { planned: 'badge-amber', filled: 'badge-green', skipped: 'badge-gray', failed: 'badge-red' }
  return <span className={map[status] ?? 'badge-gray'}>{status}</span>
}

export default async function CalendarPage() {
  const supabase = await createClient()
  const start = new Date()
  const end = new Date(Date.now() + 13 * 24 * 3600 * 1000)

  const { data: schedules } = await supabase
    .from('yt_schedules')
    .select('id, slot_date, slot_time, video_kind, status, yt_channels(title)')
    .gte('slot_date', start.toISOString().slice(0, 10))
    .lte('slot_date', end.toISOString().slice(0, 10))
    .order('slot_date')
    .order('slot_time')

  const byDate = new Map<string, typeof schedules>()
  for (const s of schedules ?? []) {
    const list = byDate.get(s.slot_date) ?? []
    list.push(s)
    byDate.set(s.slot_date, list as any)
  }

  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Content calendar</h1>
      <p className="text-sm text-neutral-600">Next 14 days. Edit a slot's time/date from the Uploads or Today pages before it's produced.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {days.map((day) => (
          <div key={day} className="card">
            <div className="font-medium">{new Date(day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
            <ul className="mt-2 space-y-2">
              {(byDate.get(day) ?? []).map((s: any) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <span>{s.slot_time} · {s.video_kind} · {s.yt_channels?.title}</span>
                  <StatusBadge status={s.status} />
                </li>
              ))}
              {!(byDate.get(day) ?? []).length && <li className="text-xs text-neutral-400">No slots yet</li>}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
