// @ts-nocheck
'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { icon: '📊', label: 'Dashboard', href: '/dashboard' },
  { icon: '🚐', label: 'My Vans',   href: '/dashboard/vans' },
  { icon: '📦', label: 'Orders',    href: '/dashboard/orders' },
  { icon: '🎪', label: 'Events',    href: '/van/events' },
  { icon: '📋', label: 'Menu',      href: '/dashboard/menu' },
  { icon: '💳', label: 'Billing',   href: '/dashboard/billing' },
  { icon: '🧼', label: 'Hygiene',   href: '/dashboard/hygiene' },
  { icon: '💬', label: 'WhatsApp',  href: '/dashboard/whatsapp' },
  { icon: '⚙️', label: 'Settings',  href: '/dashboard/settings', active: true },
]

export default function SettingsPage() {
  const [biz, setBiz]     = useState(null)
  const [form, setForm]   = useState({ name:'', description:'', phone:'', email:'', website:'' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState('')
  const [bizId, setBizId]     = useState(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/login'; return }
      let { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
      let { data: business } = userData?.id
        ? await supabase.from('businesses').select('*').eq('owner_id', userData.id).maybeSingle()
        : { data: null }
      // RPC fallback if business not found via RLS
      if (!business) {
        const { data: rpcBiz } = await supabase.rpc('get_my_business').maybeSingle()
        if (rpcBiz) business = rpcBiz
      }
      if (!business) { window.location.href = '/register/business'; return }
      setBiz(business)
      setBizId(business.id)
      setForm({ name: business.name??'', description: business.description??'', phone: business.phone??'', email: business.email??'', website: business.website??'' })
      setLoading(false)
    })
  }, [])

  const save = async () => {
    if (!form.name) { setMsg('Business name is required'); return }
    setSaving(true); setMsg('')
    const supabase = createClient()
    const { error } = await supabase.from('businesses').update({ name:form.name, description:form.description, phone:form.phone, email:form.email, website:form.website }).eq('id', bizId)
    setSaving(false)
    if (error) { setMsg('Error: ' + error.message); return }
    setMsg('✅ Settings saved!')
    setTimeout(() => setMsg(''), 3000)
  }

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <>
      <style>{`
        html,body{margin:0;padding:0}
        .biz-wrap{display:flex;flex-direction:column;min-height:100vh;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .biz-topbar{background:#fff;border-bottom:1px solid #e5e7eb;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
        .biz-sidebar{width:220px;flex-shrink:0;background:#fff;border-right:1px solid #e5e7eb;padding:16px 10px;min-height:calc(100vh - 56px)}
        .biz-main{flex:1;padding:24px;max-width:680px}
        .biz-body{display:flex;flex:1}
        .biz-bottom{display:none;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e5e7eb;z-index:100;padding:6px 8px 18px;overflow-x:auto;-webkit-overflow-scrolling:touch;gap:2px}
        @media(max-width:700px){.biz-sidebar{display:none}.biz-main{padding:16px 14px 90px}.biz-bottom{display:flex;justify-content:space-around}}
      `}</style>

      <div className="biz-wrap">
        <div className="biz-topbar">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#f97316,#dc2626)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:'#fff' }}>FT</div>
            <span style={{ fontWeight:800, fontSize:15, color:'#111' }}>FoodTaxi <span style={{ color:'#f97316' }}>Business</span></span>
          </div>
          <a href="/" className="pub-site-link" style={{ fontSize:12, color:'#6366f1', textDecoration:'none', padding:'5px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontWeight:600 }}>← Public Site</a>
        </div>

        <div className="biz-body">
          <div className="biz-sidebar">
            {NAV.map(n => (
              <a key={n.href} href={n.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, marginBottom:3, fontSize:14, fontWeight:600, textDecoration:'none', color: n.active ? '#f97316' : '#555', background: n.active ? '#fff7ed' : 'transparent', border: n.active ? '1px solid #fed7aa' : '1px solid transparent' }}>
                <span>{n.icon}</span>{n.label}
              </a>
            ))}
            <div style={{ marginTop:16, paddingTop:12, borderTop:'1px solid #f3f4f6' }}>
              <button onClick={logout} style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, fontSize:13, fontWeight:600, color:'#ef4444', background:'none', border:'none', cursor:'pointer', width:'100%' }}>🚪 Sign Out</button>
            </div>
          </div>

          <div className="biz-main">
            <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#111' }}>⚙️ Business Settings</h1>
            <p style={{ color:'#888', margin:'0 0 24px', fontSize:13 }}>Update your business profile and contact details</p>

            {msg && <div style={{ padding:'12px 16px', borderRadius:10, background: msg.startsWith('✅') ? '#d1fae5' : '#fee2e2', color: msg.startsWith('✅') ? '#065f46' : '#991b1b', marginBottom:16, fontWeight:600, fontSize:14 }}>{msg}</div>}

            {loading ? (
              <div style={{ textAlign:'center', padding:60, color:'#888' }}>Loading…</div>
            ) : (
              <div style={{ background:'#fff', borderRadius:14, padding:'24px', boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
                {[
                  { label:'Business Name *', key:'name', type:'text', placeholder:'Your business name' },
                  { label:'Phone Number', key:'phone', type:'tel', placeholder:'+44 7700 900000' },
                  { label:'Contact Email', key:'email', type:'email', placeholder:'hello@yourbusiness.com' },
                  { label:'Website', key:'website', type:'url', placeholder:'https://yourbusiness.com' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom:16 }}>
                    <label style={{ fontSize:12, fontWeight:700, color:'#555', display:'block', marginBottom:6 }}>{f.label}</label>
                    <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))} placeholder={f.placeholder}
                      style={{ width:'100%', padding:'11px 14px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:14, outline:'none', boxSizing:'border-box' }} />
                  </div>
                ))}
                <div style={{ marginBottom:20 }}>
                  <label style={{ fontSize:12, fontWeight:700, color:'#555', display:'block', marginBottom:6 }}>About Your Business</label>
                  <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="Tell customers about your food van..."
                    rows={4} style={{ width:'100%', padding:'11px 14px', borderRadius:8, border:'1px solid #e5e7eb', fontSize:14, outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'inherit' }} />
                </div>
                <button onClick={save} disabled={saving} style={{ width:'100%', padding:'13px', borderRadius:10, border:'none', background:'#f97316', color:'#fff', fontSize:15, fontWeight:700, cursor:'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving…' : 'Save Settings'}
                </button>
              </div>
            )}
          </div>
        </div>

        <nav className="biz-bottom">
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
