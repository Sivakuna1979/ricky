// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'

const CARD = { background: '#fff', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: 8 }
const CATEGORIES = ['stock', 'hygiene', 'vehicle', 'staff', 'reports', 'marketing', 'events']
const CATEGORY_ICON: Record<string, string> = { stock: '📦', hygiene: '🧼', vehicle: '🚐', staff: '👥', reports: '📊', marketing: '💡', events: '🎉' }
const PRIORITY_COLOR: Record<string, string> = { INFO: '#6366f1', ACTION: '#f59e0b', IMPORTANT: '#dc2626', CRITICAL: '#991b1b' }

export function NotificationCentre() {
  const [data, setData] = useState<any>(null)
  const [category, setCategory] = useState<string | null>(null)

  const load = () => {
    const q = category ? `?category=${category}` : ''
    fetch(`/api/notifications${q}`).then(r => r.json()).then(setData)
  }
  useEffect(load, [category])

  const markRead = async (ids: string[]) => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
    load()
  }
  const markAllRead = async () => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mark_all_read: true }) })
    load()
  }

  if (!data) return <div style={{ color: '#888', padding: 20 }}>Loading…</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setCategory(null)} style={{ padding: '6px 12px', borderRadius: 16, border: !category ? 'none' : '1px solid #e5e7eb', background: !category ? '#111' : '#fff', color: !category ? '#fff' : '#555', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>All</button>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategory(c)} style={{ padding: '6px 12px', borderRadius: 16, border: category === c ? 'none' : '1px solid #e5e7eb', background: category === c ? '#111' : '#fff', color: category === c ? '#fff' : '#555', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{CATEGORY_ICON[c]} {c}</button>
          ))}
        </div>
        {data.unread_count > 0 && <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Mark all read ({data.unread_count})</button>}
      </div>

      {data.notifications.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', color: '#888' }}>No notifications{category ? ' in this category' : ''}.</div>
      ) : (
        <div>
          {data.notifications.map((n: any) => (
            <div key={n.id} style={{ ...CARD, opacity: n.is_read ? 0.6 : 1, borderLeft: `4px solid ${PRIORITY_COLOR[n.data?.priority] ?? '#6366f1'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{n.title}</div>
                  <div style={{ fontSize: 13, color: '#555', whiteSpace: 'pre-line', marginTop: 4 }}>{n.body}</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>{new Date(n.sent_at).toLocaleString('en-GB')}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  {n.data?.action_url && <a href={n.data.action_url} style={{ fontSize: 12, color: '#6366f1', fontWeight: 700, textDecoration: 'none' }}>Open →</a>}
                  {!n.is_read && <button onClick={() => markRead([n.id])} style={{ background: 'none', border: 'none', color: '#888', fontSize: 11, cursor: 'pointer' }}>Mark read</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
