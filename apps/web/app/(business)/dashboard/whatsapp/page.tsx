// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function WhatsAppPage() {
  const [loading, setLoading]   = useState(true)
  const [bizName, setBizName]   = useState('')
  const [channel, setChannel]   = useState<any>(null)
  const [requested, setRequested] = useState(false)
  const [form, setForm]         = useState({ phone:'', note:'' })
  const [sending, setSending]   = useState(false)
  const [error, setError]       = useState('')

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
      const res = await fetch('/api/whatsapp/channel')
      const data = await res.json().catch(() => ({}))
      setChannel(data.channel ?? null)
      setRequested(Boolean(data.requested))
      setLoading(false)
    })
  }, [])

  const requestSetup = async () => {
    setSending(true)
    setError('')
    const res = await fetch('/api/whatsapp/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }))
    if (!res.ok || data.error) { setError(data.error ?? 'Could not send request'); setSending(false); return }
    setRequested(true)
    setSending(false)
  }

  const NAV = [
    { icon: '📊', label: 'Dashboard', href: '/dashboard' },
    { icon: '🚐', label: 'My Vans',   href: '/dashboard/vans' },
    { icon: '📦', label: 'Orders',    href: '/dashboard/orders' },
  { icon: '🎪', label: 'Events',    href: '/van/events' },
    { icon: '📋', label: 'Menu',      href: '/dashboard/menu' },
  { icon: '🧼', label: 'Hygiene',   href: '/dashboard/hygiene' },
    { icon: '💬', label: 'WhatsApp',  href: '/dashboard/whatsapp', active: true },
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
        .bottom{display:none;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e5e7eb;z-index:100;padding:6px 8px 18px;overflow-x:auto;-webkit-overflow-scrolling:touch;gap:2px}
        @media(max-width:700px){.sidebar{display:none}.main{padding:16px 14px 90px}.bottom{display:flex;justify-content:space-around}}
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
            <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#111' }}>💬 WhatsApp Ordering</h1>
            <p style={{ color:'#888', margin:'0 0 20px', fontSize:13 }}>Your customers text their order on WhatsApp — our AI takes it, adds it to your Orders page and confirms back to them instantly. 24/7, hands-free.</p>

            {loading ? (
              <div style={{ textAlign:'center', padding:40, color:'#888' }}>Loading…</div>
            ) : channel ? (
              <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:14, padding:'20px', display:'flex', alignItems:'center', gap:14 }}>
                <span style={{ fontSize:36 }}>✅</span>
                <div>
                  <div style={{ fontWeight:800, fontSize:16, color:'#166534' }}>WhatsApp ordering is ACTIVE</div>
                  <div style={{ fontSize:13, color:'#15803d', marginTop:2 }}>{channel.display_number ? `Customers can order at ${channel.display_number}` : 'Customers can text their orders to your WhatsApp number.'}</div>
                  <div style={{ fontSize:12, color:'#4d7c5f', marginTop:6 }}>Orders arrive in your Orders page automatically. Need a change? Contact FoodTaxi support.</div>
                </div>
              </div>
            ) : requested ? (
              <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:14, padding:'20px', display:'flex', alignItems:'center', gap:14 }}>
                <span style={{ fontSize:36 }}>⏳</span>
                <div>
                  <div style={{ fontWeight:800, fontSize:16, color:'#1e40af' }}>Setup requested</div>
                  <div style={{ fontSize:13, color:'#1d4ed8', marginTop:2 }}>The FoodTaxi team is setting up WhatsApp ordering for you. We'll be in touch shortly — nothing else for you to do.</div>
                </div>
              </div>
            ) : (
              <div style={{ background:'#fff', borderRadius:14, padding:20, boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
                <div style={{ display:'flex', gap:12, marginBottom:16 }}>
                  {['🤖 AI reads every order', '⚡ Instant confirmations', '📦 Straight to your Orders'].map(t => (
                    <div key={t} style={{ flex:1, background:'#f9fafb', borderRadius:10, padding:'10px 8px', fontSize:12, fontWeight:700, color:'#444', textAlign:'center' }}>{t}</div>
                  ))}
                </div>
                <div style={{ fontWeight:800, fontSize:15, color:'#111', marginBottom:4 }}>Get it set up — free, done for you</div>
                <div style={{ fontSize:13, color:'#888', marginBottom:14 }}>Our team handles all the technical setup. Just tell us how to reach you.</div>

                <label style={{ fontSize:12, fontWeight:700, color:'#555', display:'block', marginBottom:5 }}>Best phone number to contact you</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="07xxx xxxxxx" style={inp} />

                <label style={{ fontSize:12, fontWeight:700, color:'#555', display:'block', margin:'12px 0 5px' }}>Anything we should know? (optional)</label>
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} placeholder="e.g. I already use WhatsApp Business on 07xxx" style={{ ...inp, resize:'vertical' }} />

                <button onClick={requestSetup} disabled={sending || !form.phone.trim()}
                  style={{ width:'100%', marginTop:16, padding:'13px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#128c7e,#25d366)', color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', opacity: (sending || !form.phone.trim()) ? 0.6 : 1 }}>
                  {sending ? 'Sending…' : '💬 Request WhatsApp Ordering'}
                </button>
                {error && <div style={{ marginTop:10, fontSize:13, fontWeight:700, color:'#ef4444' }}>⚠️ {error}</div>}
              </div>
            )}
          </div>
        </div>
        <nav className="bottom">
          {NAV.map(n => (
            <a key={n.href} href={n.href} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, textDecoration:'none', color: n.active ? '#f97316' : '#9ca3af', fontSize:10, fontWeight:600, minWidth:48 }}>
              <span style={{ fontSize:20 }}>{n.icon}</span>{n.label}
            </a>
          ))}
        </nav>
      </div>
    </>
  )
}
