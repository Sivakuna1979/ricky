// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'

const CARD = { background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: 20 }
const LABEL = { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' as const, marginBottom: 8 }
const CATEGORY_ICON: Record<string, string> = { stock: '📦', hygiene: '🧼', vehicle: '🚐', staff: '👥', reports: '📊', marketing: '💡', events: '🎉' }

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', background: on ? '#059669' : '#d1d5db', position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
    </button>
  )
}

export function AutomationsCentre() {
  const [tab, setTab] = useState<'Settings' | 'Recent Runs' | 'Failed'>('Settings')
  const [settings, setSettings] = useState<any[]>([])
  const [runs, setRuns] = useState<any[]>([])
  const [canManage, setCanManage] = useState(true)

  const loadSettings = () => fetch('/api/automations/settings').then(r => r.json()).then(d => setSettings(Array.isArray(d) ? d : []))
  const loadRuns = (status?: string) => fetch(`/api/automations/runs${status ? `?status=${status}` : ''}`).then(r => r.json()).then(d => setRuns(Array.isArray(d) ? d : []))

  useEffect(() => { loadSettings() }, [])
  useEffect(() => { if (tab === 'Recent Runs') loadRuns(); if (tab === 'Failed') loadRuns('FAILED') }, [tab])

  const toggle = async (automation_type: string, enabled: boolean) => {
    const res = await fetch('/api/automations/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ automation_type, enabled }) })
    if (res.status === 403) { setCanManage(false); return }
    loadSettings()
  }
  const toggleChannel = async (s: any, channel: string) => {
    const channels = { ...s.channels, [channel]: !s.channels[channel] }
    await fetch('/api/automations/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ automation_type: s.automation_type, channels }) })
    loadSettings()
  }
  const retry = async (runId: string) => {
    await fetch(`/api/automations/runs/${runId}/retry`, { method: 'POST' })
    loadRuns('FAILED')
  }

  const byCategory: Record<string, any[]> = {}
  for (const s of settings) (byCategory[s.category] ??= []).push(s)

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {(['Settings', 'Recent Runs', 'Failed'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 16px', borderRadius: 20, border: tab === t ? 'none' : '1px solid #e5e7eb', background: tab === t ? '#f97316' : '#fff', color: tab === t ? '#fff' : '#555', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>{t}</button>
        ))}
      </div>

      {tab === 'Settings' && (
        <div>
          {!canManage && <div style={{ ...CARD, background: '#fee2e2', color: '#991b1b', fontSize: 13 }}>You don't have permission to change automation settings — ask your business owner or admin.</div>}
          {Object.entries(byCategory).map(([cat, items]) => (
            <div key={cat} style={CARD}>
              <div style={LABEL}>{CATEGORY_ICON[cat]} {cat}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {items.map((s: any) => (
                  <div key={s.automation_type} style={{ paddingBottom: 12, borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{s.label}</div>
                        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{s.description}</div>
                      </div>
                      <Toggle on={s.enabled} onClick={() => toggle(s.automation_type, !s.enabled)} />
                    </div>
                    {s.enabled && (
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        {(['in_app', 'email', 'sms', 'whatsapp'] as const).map(ch => (
                          <button key={ch} onClick={() => toggleChannel(s, ch)} disabled={ch === 'whatsapp'} style={{ padding: '4px 10px', borderRadius: 12, border: s.channels[ch] ? 'none' : '1px solid #e5e7eb', background: s.channels[ch] ? '#111' : '#fff', color: s.channels[ch] ? '#fff' : '#888', fontSize: 11, fontWeight: 700, cursor: ch === 'whatsapp' ? 'not-allowed' : 'pointer', opacity: ch === 'whatsapp' ? 0.5 : 1 }}>
                            {ch.replace('_', '-').toUpperCase()}{ch === 'whatsapp' ? ' (soon)' : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(tab === 'Recent Runs' || tab === 'Failed') && (
        <div>
          {runs.length === 0 ? <div style={{ ...CARD, textAlign: 'center', color: '#888' }}>Nothing to show yet.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {runs.map((r: any) => (
                <div key={r.id} style={{ ...CARD, margin: 0, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{r.automation_type.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: 12, color: '#888' }}>{new Date(r.executed_at).toLocaleString('en-GB')}{r.failure_reason ? ` · ${r.failure_reason}` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: r.status === 'FAILED' ? '#fee2e2' : r.status === 'COMPLETED' ? '#d1fae5' : '#f3f4f6', color: r.status === 'FAILED' ? '#991b1b' : r.status === 'COMPLETED' ? '#065f46' : '#555' }}>{r.status}</span>
                      {r.status === 'FAILED' && canManage && <button onClick={() => retry(r.id)} style={{ padding: '4px 12px', borderRadius: 8, background: '#f97316', color: '#fff', border: 'none', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Retry</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
