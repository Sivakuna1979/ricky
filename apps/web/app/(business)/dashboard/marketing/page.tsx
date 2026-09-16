// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function MarketingPage() {
  const [loading, setLoading]     = useState(true)
  const [bizName, setBizName]     = useState('')
  const [audience, setAudience]   = useState(0)
  const [subject, setSubject]     = useState('')
  const [message, setMessage]     = useState('')
  const [sending, setSending]     = useState(false)
  const [error, setError]         = useState('')
  const [result, setResult]       = useState<any>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/login'; return }
      const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      let biz: any = null
      if (userData?.id) {
        const { data: b } = await supabase.from('businesses').select('id, name').eq('owner_id', userData.id).maybeSingle()
        biz = b
      }
      if (!biz) { const { data: r } = await supabase.rpc('get_my_business'); if (r) biz = r }
      if (!biz) { window.location.href = '/register/business'; return }
      setBizName(biz.name ?? '')
      const res = await fetch('/api/marketing/audience')
      const data = await res.json().catch(() => ({}))
      setAudience(data.count ?? 0)
      setLoading(false)
    })
  }, [])

  const send = async () => {
    if (!subject.trim() || !message.trim()) return
    if (!confirm(`Send this to ${audience} customer${audience !== 1 ? 's' : ''}? This can't be undone.`)) return
    setSending(true)
    setError('')
    setResult(null)
    const res = await fetch('/api/marketing/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, message }),
    })
    const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }))
    if (!res.ok || data.error) { setError(data.error ?? 'Could not send'); setSending(false); return }
    setResult(data)
    setSubject(''); setMessage('')
    setSending(false)
  }

  const NAV = [
    { icon: '📊', label: 'Dashboard', href: '/dashboard' },
    { icon: '🚐', label: 'My Vans',   href: '/dashboard/vans' },
    { icon: '📦', label: 'Orders',    href: '/dashboard/orders' },
    { icon: '🧾', label: 'POS',       href: '/dashboard/pos' },
    { icon: '🍳', label: 'Kitchen',   href: '/dashboard/kitchen' },
    { icon: '🎪', label: 'Events',    href: '/van/events' },
    { icon: '📋', label: 'Menu',      href: '/dashboard/menu' },
    { icon: '🧼', label: 'Hygiene',   href: '/dashboard/hygiene' },
    { icon: '💬', label: 'WhatsApp',  href: '/dashboard/whatsapp' },
    { icon: '📣', label: 'Marketing', href: '/dashboard/marketing', active: true },
    { icon: '⚙️', label: 'Settings',  href: '/dashboard/settings' },
  ]

  const inp = { width:'100%', padding:'11px 13px', borderRadius:10, border:'1px solid #e5e7eb', fontSize:14, outline:'none', boxSizing:'border-box' as const, fontFamily:'inherit' }

  return (
    <>
      <style>{`
        html,body{margin:0;padding:0}
        .wrap{display:flex;flex-direction:column;min-height:100vh;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .topbar{background:#fff;border-bottom:1px solid #e5e7eb;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
        .sidebar{width:220px;flex-shrink:0;background:#fff;border-right:1px solid #e5e7eb;padding:16px 10px;min-height:calc(100vh - 56px)}
        .main{flex:1;padding:24px;max-width:640px}
        .body{display:flex;flex:1}
        .bottom{display:none;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e5e7eb;z-index:100;padding:8px 10px 18px;overflow-x:auto;-webkit-overflow-scrolling:touch;gap:14px;scroll-snap-type:x proximity;overscroll-behavior-x:contain;scrollbar-width:none}
        .bottom::-webkit-scrollbar,.biz-bottom::-webkit-scrollbar{display:none}
        @media(max-width:700px){.sidebar{display:none}.main{padding:16px 14px 90px}.bottom{display:flex;justify-content:flex-start}}
      `}</style>
      <div className="wrap">
        <div className="topbar">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#f97316,#dc2626)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:'#fff' }}>FT</div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#111', lineHeight:1 }}>FoodTaxi</div>
              {bizName && <div style={{ fontSize:11, color:'#888' }}>{bizName}</div>}
            </div>
          </div>
          <a href="/" style={{ fontSize:12, color:'#6366f1', textDecoration:'none', padding:'5px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontWeight:600 }}>← Public Site</a>
        </div>
        <div className="body">
          <div className="sidebar">
            {NAV.map(n => (
              <a key={n.href} href={n.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, marginBottom:3, fontSize:14, fontWeight:600, textDecoration:'none', color: n.active ? '#f97316' : '#555', background: n.active ? '#fff7ed' : 'transparent', border: n.active ? '1px solid #fed7aa' : '1px solid transparent' }}>
                <span style={{ fontSize:16 }}>{n.icon}</span>{n.label}
              </a>
            ))}
          </div>
          <div className="main">
            <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#111' }}>📣 Email Marketing</h1>
            <p style={{ color:'#888', margin:'0 0 20px', fontSize:13 }}>Send a one-off deal or announcement to customers who've ordered from you before and left an email address.</p>

            {loading ? (
              <div style={{ textAlign:'center', padding:40, color:'#888' }}>Loading…</div>
            ) : (
              <div style={{ background:'#fff', borderRadius:14, padding:20, boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
                <div style={{ background: audience ? '#f0fdf4' : '#fef3c7', border: `1px solid ${audience ? '#bbf7d0' : '#fde68a'}`, borderRadius:10, padding:'12px 14px', marginBottom:18, fontSize:13, fontWeight:700, color: audience ? '#166534' : '#92400e' }}>
                  {audience ? `📧 ${audience} customer${audience !== 1 ? 's' : ''} will receive this` : '⚠️ No customer emails yet — ask for an email at checkout, or import WhatsApp orders that include one'}
                </div>

                <label style={{ fontSize:12, fontWeight:700, color:'#555', display:'block', marginBottom:5 }}>Subject</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. This Friday only — 20% off!" style={{ ...inp, marginBottom:14 }} />

                <label style={{ fontSize:12, fontWeight:700, color:'#555', display:'block', marginBottom:5 }}>Message</label>
                <textarea value={message} onChange={e => setMessage(e.target.value)} rows={7} placeholder="Write your offer or announcement here..." style={{ ...inp, resize:'vertical', marginBottom:6 }} />
                <div style={{ fontSize:11, color:'#999', marginBottom:16 }}>An unsubscribe link is added automatically at the bottom of every email — that's required by law for marketing emails.</div>

                <button onClick={send} disabled={sending || !audience || !subject.trim() || !message.trim()}
                  style={{ width:'100%', padding:'13px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#f97316,#dc2626)', color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', opacity: (sending || !audience || !subject.trim() || !message.trim()) ? 0.6 : 1 }}>
                  {sending ? 'Sending…' : `📣 Send to ${audience} customer${audience !== 1 ? 's' : ''}`}
                </button>

                {error && <div style={{ marginTop:12, fontSize:13, fontWeight:700, color:'#ef4444' }}>⚠️ {error}</div>}
                {result && <div style={{ marginTop:12, fontSize:13, fontWeight:700, color:'#059669' }}>✅ Sent to {result.sent} of {result.total} customers.</div>}
              </div>
            )}
          </div>
        </div>
        <nav className="bottom">
          {NAV.map(n => (
            <a key={n.href} href={n.href} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, textDecoration:'none', color: n.active ? '#f97316' : '#9ca3af', fontSize:10, fontWeight:600, minWidth:56, flexShrink:0, padding:'2px 4px', scrollSnapAlign:'start' }}>
              <span style={{ fontSize:20 }}>{n.icon}</span>{n.label}
            </a>
          ))}
        </nav>
      </div>
    </>
  )
}
