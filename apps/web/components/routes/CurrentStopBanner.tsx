// @ts-nocheck
'use client'
// G5 — lets the till pick which stop a sale belongs to, defaulting to the
// current stop of today's active route session (if one was started) and
// falling back gracefully to "no stop selected" for any business that
// doesn't use route sessions at all. Never required to complete a sale.
import { useEffect, useState } from 'react'

function currentStopFor(session: any) {
  if (!session) return null
  return (session.stops ?? []).find((s: any) => s.status === 'arrived') ?? (session.stops ?? []).find((s: any) => s.status === 'pending') ?? null
}

export function CurrentStopBanner({ vanId, onStopChange }: { vanId: string | null; onStopChange: (stopId: string | null) => void }) {
  const [session, setSession] = useState<any>(null)
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null)

  useEffect(() => {
    if (!vanId) { setSession(null); return }
    const today = new Date().toISOString().slice(0, 10)
    fetch(`/api/routes/sessions?van_id=${vanId}&date=${today}`).then(r => r.json()).then(data => {
      setSession(data)
      const current = currentStopFor(data)
      setSelectedStopId(current?.van_schedule_id ?? null)
    }).catch(() => setSession(null))
  }, [vanId])

  useEffect(() => { onStopChange(selectedStopId) }, [selectedStopId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!session || !session.stops?.length) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '8px 12px', marginBottom: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#0369a1' }}>📍 Current stop:</span>
      <select
        value={selectedStopId ?? ''}
        onChange={e => setSelectedStopId(e.target.value || null)}
        style={{ padding: '5px 8px', borderRadius: 8, border: '1px solid #bae6fd', fontSize: 12, fontWeight: 600, color: '#0369a1', background: '#fff' }}
      >
        <option value="">No stop selected</option>
        {session.stops.filter((s: any) => s.van_schedule_id).map((s: any) => (
          <option key={s.id} value={s.van_schedule_id}>{s.location_name}{s.status === 'departed' ? ' (departed)' : ''}</option>
        ))}
      </select>
      <a href="/dashboard/routes" style={{ fontSize: 11, color: '#0369a1', marginLeft: 'auto' }}>Manage route →</a>
    </div>
  )
}
