// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { AdminShell } from '../_shared'

type AuthUser = {
  id: string
  email: string
  confirmed: boolean
  created_at: string
  last_sign_in: string | null
}

export default function AdminUsersPage() {
  const [users, setUsers]     = useState<AuthUser[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg]         = useState<{ text: string; ok: boolean } | null>(null)
  const [busy, setBusy]       = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(d => { setUsers(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const action = async (act: 'reset' | 'confirm', u: AuthUser) => {
    setBusy(`${act}-${u.id}`)
    setMsg(null)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: act, email: u.email, user_id: u.id }),
    })
    const data = await res.json()
    setMsg({ text: data.message ?? data.error ?? 'Done', ok: res.ok })
    if (act === 'confirm') {
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, confirmed: true } : x))
    }
    setBusy(null)
  }

  const fixAccount = async (u: AuthUser) => {
    const pwd = prompt(`Set temporary password for ${u.email}:`, 'FoodTaxi2025!')
    if (!pwd) return
    setBusy(`fix-${u.id}`)
    setMsg(null)
    const res = await fetch('/api/admin/fix-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: u.email, password: pwd, role: 'business_owner' }),
    })
    const data = await res.json()
    const detail = data.log ? '\n' + data.log.join('\n') : ''
    setMsg({ text: (data.message ?? data.error ?? 'Done') + detail, ok: res.ok })
    if (res.ok) setUsers(prev => prev.map(x => x.id === u.id ? { ...x, confirmed: true } : x))
    setBusy(null)
  }

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'2-digit' }) : '—'

  return (
    <AdminShell active="/admin/users">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#fff' }}>Users</h1>
          <p style={{ fontSize:13, color:'rgba(255,255,255,.4)', margin:0 }}>{users.length} auth accounts</p>
        </div>
      </div>

      {msg && (
        <div style={{ background: msg.ok ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)', border:`1px solid ${msg.ok ? 'rgba(16,185,129,.4)' : 'rgba(239,68,68,.4)'}`, borderRadius:10, padding:'12px 16px', marginBottom:20, color: msg.ok ? '#6ee7b7' : '#fca5a5', fontSize:14 }}>
          {msg.ok ? '✅' : '⚠️'} {msg.text}
        </div>
      )}

      <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:14, overflow:'hidden' }}>
        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'rgba(255,255,255,.3)', fontSize:14 }}>Loading…</div>
        ) : users.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'rgba(255,255,255,.3)', fontSize:14 }}>No users found</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(255,255,255,.07)', background:'rgba(255,255,255,.02)' }}>
                  {['Email', 'Status', 'Joined', 'Last Sign In', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign:'left', padding:'12px 16px', color:'rgba(255,255,255,.35)', fontWeight:600, fontSize:11, textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} style={{ borderBottom: i < users.length-1 ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
                    <td style={{ padding:'13px 16px', color:'#e2e8f0', fontWeight:500 }}>{u.email}</td>
                    <td style={{ padding:'13px 16px' }}>
                      {u.confirmed ? (
                        <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, color:'#4ade80', background:'rgba(74,222,128,.12)' }}>✓ Confirmed</span>
                      ) : (
                        <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:20, color:'#fbbf24', background:'rgba(251,191,36,.12)' }}>⚠ Unconfirmed</span>
                      )}
                    </td>
                    <td style={{ padding:'13px 16px', color:'rgba(255,255,255,.4)' }}>{fmt(u.created_at)}</td>
                    <td style={{ padding:'13px 16px', color:'rgba(255,255,255,.4)' }}>{fmt(u.last_sign_in)}</td>
                    <td style={{ padding:'13px 16px' }}>
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                        <button
                          onClick={() => fixAccount(u)}
                          disabled={!!busy}
                          style={{ padding:'6px 12px', borderRadius:8, border:'1px solid rgba(99,102,241,.5)', background:'rgba(99,102,241,.15)', color:'#a5b4fc', fontSize:12, fontWeight:700, cursor:'pointer', opacity: busy ? 0.5 : 1 }}>
                          {busy === `fix-${u.id}` ? '…' : '🔧 Fix Account'}
                        </button>
                        <button
                          onClick={() => action('reset', u)}
                          disabled={!!busy}
                          style={{ padding:'6px 12px', borderRadius:8, border:'1px solid rgba(249,115,22,.4)', background:'rgba(249,115,22,.1)', color:'#fb923c', fontSize:12, fontWeight:700, cursor:'pointer', opacity: busy ? 0.5 : 1 }}>
                          {busy === `reset-${u.id}` ? '…' : '📧 Send Reset'}
                        </button>
                        {!u.confirmed && (
                          <button
                            onClick={() => action('confirm', u)}
                            disabled={!!busy}
                            style={{ padding:'6px 12px', borderRadius:8, border:'1px solid rgba(74,222,128,.4)', background:'rgba(74,222,128,.1)', color:'#4ade80', fontSize:12, fontWeight:700, cursor:'pointer', opacity: busy ? 0.5 : 1 }}>
                            {busy === `confirm-${u.id}` ? '…' : '✓ Confirm Email'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  )
}
