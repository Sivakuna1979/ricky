// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function WhatsAppSetupPage() {
  const [loading, setLoading]   = useState(true)
  const [bizName, setBizName]   = useState('')
  const [vans, setVans]         = useState<any[]>([])
  const [channel, setChannel]   = useState<any>(null)
  const [form, setForm]         = useState({ van_id:'', phone_number_id:'', access_token:'', display_number:'' })
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
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
      const { data: vanList } = await supabase.from('vans').select('id, name').eq('business_id', biz.id).order('name')
      setVans(vanList ?? [])
      const res = await fetch('/api/whatsapp/channel')
      const data = await res.json().catch(() => ({}))
      if (data.channel) {
        setChannel(data.channel)
        setForm(f => ({ ...f, van_id: data.channel.van_id, phone_number_id: data.channel.phone_number_id, display_number: data.channel.display_number ?? '' }))
      } else if (vanList?.length) {
        setForm(f => ({ ...f, van_id: vanList[0].id }))
      }
      setLoading(false)
    })
  }, [])

  const save = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    const res = await fetch('/api/whatsapp/channel', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }))
    if (!res.ok || data.error) { setError(data.error ?? 'Save failed'); setSaving(false); return }
    setSaved(true)
    setChannel({ ...form })
    setForm(f => ({ ...f, access_token: '' }))
    setSaving(false)
  }

  const disconnect = async () => {
    if (!confirm('Disconnect WhatsApp ordering?')) return
    setSaving(true)
    await fetch('/api/whatsapp/channel', { method: 'DELETE' })
    setChannel(null)
    setSaving(false)
  }

  const NAV = [
    { icon: '📊', label: 'Dashboard', href: '/dashboard' },
    { icon: '🚐', label: 'My Vans',   href: '/dashboard/vans' },
    { icon: '📦', label: 'Orders',    href: '/dashboard/orders' },
    { icon: '📋', label: 'Menu',      href: '/dashboard/menu' },
    { icon: '💬', label: 'WhatsApp',  href: '/dashboard/whatsapp', active: true },
    { icon: '⚙️', label: 'Settings',  href: '/dashboard/settings' },
  ]

  const inp = { width:'100%', padding:'11px 13px', borderRadius:10, border:'1px solid #e5e7eb', fontSize:14, outline:'none', boxSizing:'border-box' as const, fontFamily:'inherit' }
  const lbl = { fontSize:12, fontWeight:700, color:'#555', display:'block', marginBottom:5, marginTop:12 }

  return (
    <>
      <style>{`
        html,body{margin:0;padding:0}
        .wrap{display:flex;flex-direction:column;min-height:100vh;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .topbar{background:#fff;border-bottom:1px solid #e5e7eb;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
        .sidebar{width:220px;flex-shrink:0;background:#fff;border-right:1px solid #e5e7eb;padding:16px 10px;min-height:calc(100vh - 56px)}
        .main{flex:1;padding:24px;max-width:760px}
        .body{display:flex;flex:1}
        .bottom{display:none;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e5e7eb;z-index:100;padding:6px 0 18px}
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
            <p style={{ color:'#888', margin:'0 0 20px', fontSize:13 }}>Customers text your WhatsApp number — AI reads the order, adds it to your Orders page and replies with a confirmation. Automatic, 24/7.</p>

            {loading ? (
              <div style={{ textAlign:'center', padding:40, color:'#888' }}>Loading…</div>
            ) : (
              <>
                {channel && (
                  <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:12, padding:'14px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:22 }}>✅</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:800, fontSize:14, color:'#166534' }}>WhatsApp ordering is ON</div>
                      <div style={{ fontSize:12, color:'#15803d' }}>{channel.display_number || `Number ID ${channel.phone_number_id}`}</div>
                    </div>
                    <button onClick={disconnect} disabled={saving} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #fecaca', background:'#fff', color:'#ef4444', fontWeight:700, fontSize:12, cursor:'pointer' }}>Disconnect</button>
                  </div>
                )}

                <div style={{ background:'#fff', borderRadius:14, padding:20, boxShadow:'0 1px 3px rgba(0,0,0,0.07)', marginBottom:16 }}>
                  <div style={{ fontWeight:800, fontSize:15, color:'#111', marginBottom:4 }}>{channel ? 'Update connection' : 'Connect your WhatsApp number'}</div>
                  <div style={{ fontSize:12, color:'#888' }}>You need a free Meta developer app — see the guide below.</div>

                  <label style={lbl}>Which van takes the orders?</label>
                  <select value={form.van_id} onChange={e => setForm(f => ({ ...f, van_id: e.target.value }))} style={inp}>
                    {vans.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>

                  <label style={lbl}>Phone number ID (from Meta → WhatsApp → API Setup)</label>
                  <input value={form.phone_number_id} onChange={e => setForm(f => ({ ...f, phone_number_id: e.target.value }))} placeholder="e.g. 1144608618743220" style={inp} />

                  <label style={lbl}>Access token {channel ? '(leave blank to keep the current one)' : ''}</label>
                  <input value={form.access_token} onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))} placeholder="EAA..." type="password" style={inp} />

                  <label style={lbl}>Your WhatsApp number (shown to you, optional)</label>
                  <input value={form.display_number} onChange={e => setForm(f => ({ ...f, display_number: e.target.value }))} placeholder="+44 7xxx xxxxxx" style={inp} />

                  <button onClick={save} disabled={saving || !form.van_id || !form.phone_number_id}
                    style={{ width:'100%', marginTop:16, padding:'13px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#128c7e,#25d366)', color:'#fff', fontWeight:800, fontSize:15, cursor:'pointer', opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Saving…' : channel ? '✓ Update' : '✓ Connect WhatsApp Ordering'}
                  </button>
                  {saved && <div style={{ marginTop:10, fontSize:13, fontWeight:800, color:'#059669' }}>✅ Saved — text your number to test it!</div>}
                  {error && <div style={{ marginTop:10, fontSize:13, fontWeight:700, color:'#ef4444' }}>⚠️ {error}</div>}
                </div>

                <div style={{ background:'#fff', borderRadius:14, padding:20, boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontWeight:800, fontSize:15, color:'#111', marginBottom:10 }}>📖 How to get your Meta details (free, ~20 min)</div>
                  <ol style={{ margin:0, paddingLeft:18, fontSize:13, color:'#444', lineHeight:1.9 }}>
                    <li>Go to <a href="https://developers.facebook.com/apps/create/" target="_blank" rel="noopener noreferrer" style={{ color:'#128c7e', fontWeight:700 }}>developers.facebook.com</a> → Create App → type <b>Business</b></li>
                    <li>Add the <b>WhatsApp</b> product to the app</li>
                    <li>On <b>API Setup</b>: copy the <b>Phone number ID</b> and generate an <b>access token</b> — paste both above</li>
                    <li>On <b>Configuration</b>, set the webhook:<br/>
                      URL: <code style={{ background:'#f3f4f6', padding:'2px 6px', borderRadius:6, fontSize:12 }}>https://food-taxi.vercel.app/api/webhooks/whatsapp</code><br/>
                      Verify token: <code style={{ background:'#f3f4f6', padding:'2px 6px', borderRadius:6, fontSize:12 }}>foodtaxi2026</code></li>
                    <li>Under <b>Webhook fields</b>, subscribe to <b>messages</b></li>
                    <li>To go live for customers: add your own number in Meta ("Add phone number") and complete business verification, then update the Phone number ID above</li>
                  </ol>
                  <div style={{ marginTop:12, fontSize:12, color:'#888', background:'#f9fafb', borderRadius:8, padding:'10px 12px' }}>
                    🔒 Your access token is stored securely and never shown again. Generate a permanent token via Meta Business Settings → System Users so it doesn't expire.
                  </div>
                </div>
              </>
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
