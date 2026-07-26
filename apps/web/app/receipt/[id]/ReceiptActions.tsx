// @ts-nocheck
'use client'
import { useState } from 'react'

export function ReceiptActions({ orderId, existingEmail }: { orderId: string; existingEmail: string }) {
  const [email, setEmail] = useState(existingEmail)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')

  const share = async () => {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ title: 'Receipt', url }); return } catch { /* cancelled */ }
    }
    await navigator.clipboard.writeText(url).catch(() => {})
    setMsg('🔗 Link copied')
    setTimeout(() => setMsg(''), 2500)
  }

  const sendEmail = async () => {
    if (!email.trim()) { setMsg('⚠️ Enter an email address'); return }
    setSending(true); setMsg('')
    try {
      const res = await fetch(`/api/orders/${orderId}/email-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      setMsg(res.ok ? '✅ Receipt emailed' : `⚠️ ${data.error ?? 'Could not send'}`)
    } catch {
      setMsg('⚠️ Network error')
    }
    setSending(false)
  }

  const inp = { padding: '11px 13px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button onClick={() => window.print()} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#0e7490', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          🖨️ Print
        </button>
        <button onClick={share} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#333', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          🔗 Share
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Email address" style={{ ...inp, flex: 1 }} />
        <button onClick={sendEmail} disabled={sending} style={{ padding: '11px 16px', borderRadius: 10, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: sending ? 0.6 : 1, whiteSpace: 'nowrap' }}>
          {sending ? 'Sending…' : '✉️ Email'}
        </button>
      </div>
      {msg && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: msg.startsWith('✅') || msg.startsWith('🔗') ? '#059669' : '#b45309' }}>{msg}</div>}
      <div style={{ textAlign: 'center', marginTop: 10 }}>
        <a href="/dashboard/pos" style={{ fontSize: 12, color: '#888', textDecoration: 'none' }}>← Back to Till</a>
      </div>
    </div>
  )
}
