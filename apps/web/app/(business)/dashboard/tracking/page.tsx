// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tracking — FoodTaxi' }

export default async function TrackingPage() {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) redirect('/login')

  let { data: userData } = await supabase
    .from('users').select('id').eq('auth_id', user.id).maybeSingle()

  let business: any = null
  try {
    if (userData?.id) {
      const { data: b } = await supabase.from('businesses').select('id, name').eq('owner_id', userData.id).maybeSingle()
      business = b
    }
    if (!business) { const { data: r } = await supabase.rpc('get_my_business'); if (r) business = r }
  } catch (_e) {}
  if (!business) redirect('/register/business')

  const { data: vans } = await supabase
    .from('vans').select('*').eq('business_id', business.id)

  const NAV = [
    { icon: '📊', label: 'Dashboard', href: '/dashboard' },
    { icon: '🚐', label: 'My Vans',   href: '/dashboard/vans' },
    { icon: '📦', label: 'Orders',    href: '/dashboard/orders' },
    { icon: '🗺️', label: 'Tracking',  href: '/dashboard/tracking', active: true },
    { icon: '📋', label: 'Menu',      href: '/dashboard/menu' },
    { icon: '💳', label: 'My Plan',   href: '/dashboard/billing' },
  { icon: '🧼', label: 'Hygiene',   href: '/dashboard/hygiene' },
  { icon: '💬', label: 'WhatsApp',  href: '/dashboard/whatsapp' },
    { icon: '⚙️', label: 'Settings',  href: '/dashboard/settings' },
  ]

  return (
    <>
      <style>{`
        html,body{margin:0;padding:0}
        .wrap{display:flex;flex-direction:column;min-height:100vh;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
        .topbar{background:#fff;border-bottom:1px solid #e5e7eb;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
        .sidebar{width:220px;flex-shrink:0;background:#fff;border-right:1px solid #e5e7eb;padding:16px 10px;min-height:calc(100vh - 56px)}
        .main{flex:1;padding:24px;overflow-x:hidden;max-width:900px}
        .body{display:flex;flex:1}
        @media(max-width:700px){.sidebar{display:none}.main{padding:16px 14px 90px}}
      `}</style>
      <div className="wrap">
        <div className="topbar">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#f97316,#dc2626)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:'#fff' }}>FT</div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#111', lineHeight:1 }}>FoodTaxi</div>
              <div style={{ fontSize:11, color:'#888' }}>{business.name}</div>
            </div>
          </div>
          <a href="/" className="pub-site-link" style={{ fontSize:12, color:'#6366f1', textDecoration:'none', padding:'5px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontWeight:600 }}>← Public Site</a>
        </div>
        <div className="body">
          <div className="sidebar">
            {NAV.map(n => (
              <a key={n.href} href={n.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, marginBottom:3, fontSize:14, fontWeight:600, textDecoration:'none', color: n.active ? '#f97316' : '#555', background: n.active ? '#fff7ed' : 'transparent', border: n.active ? '1px solid #fed7aa' : '1px solid transparent' }}>
                <span style={{ fontSize:16 }}>{n.icon}</span>{n.label}
              </a>
            ))}
            <div style={{ margin:'16px 0 0', paddingTop:12, borderTop:'1px solid #f3f4f6' }}>
              <a href="/api/auth/logout" style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, fontSize:13, fontWeight:600, textDecoration:'none', color:'#ef4444' }}>🚪 Sign Out</a>
            </div>
          </div>
          <div className="main">
            <div style={{ marginBottom:24 }}>
              <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#111' }}>Live Tracking</h1>
              <p style={{ color:'#888', margin:0, fontSize:13 }}>Monitor your van locations in real time</p>
            </div>
            <div style={{ background:'#fff', borderRadius:14, padding:'24px', boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
              {(vans ?? []).length === 0 ? (
                <div style={{ textAlign:'center', padding:'32px 0' }}>
                  <div style={{ fontSize:48, marginBottom:12 }}>🗺️</div>
                  <div style={{ fontSize:16, fontWeight:700, color:'#111', marginBottom:8 }}>No vans to track</div>
                  <div style={{ fontSize:14, color:'#888', marginBottom:20 }}>Add a van first to use live tracking</div>
                  <a href="/dashboard/vans" style={{ padding:'10px 24px', borderRadius:10, background:'#f97316', color:'#fff', fontSize:14, fontWeight:700, textDecoration:'none' }}>Manage Vans</a>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {(vans ?? []).map(van => (
                    <div key={van.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px', borderRadius:10, background:'#f9fafb', border:'1px solid #e5e7eb' }}>
                      <div style={{ width:12, height:12, borderRadius:'50%', background: van.tracking_status === 'live' ? '#10b981' : '#d1d5db', flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:14, color:'#111' }}>{van.name || 'Unnamed Van'}</div>
                        <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{van.tracking_status === 'live' ? '🟢 Currently Live' : '⚫ Offline'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
