// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

const NAV = [
  { icon: '📊', label: 'Dashboard', href: '/dashboard' },
  { icon: '🚐', label: 'My Vans',   href: '/dashboard/vans' },
  { icon: '📦', label: 'Orders',    href: '/dashboard/orders', active: true },
  { icon: '📋', label: 'Menu',      href: '/dashboard/menu' },
  { icon: '💳', label: 'Billing',   href: '/dashboard/billing' },
  { icon: '⚙️', label: 'Settings',  href: '/dashboard/settings' },
]

const STATUS_COLORS = {
  pending:    { bg:'#fef3c7', color:'#92400e' },
  accepted:   { bg:'#dbeafe', color:'#1e40af' },
  preparing:  { bg:'#ede9fe', color:'#5b21b6' },
  ready:      { bg:'#d1fae5', color:'#065f46' },
  completed:  { bg:'#f0fdf4', color:'#166534' },
  cancelled:  { bg:'#fee2e2', color:'#991b1b' },
}

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const user = session.user

  let { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()

  let { data: biz } = userData?.id
    ? await supabase.from('businesses').select('id,name').eq('owner_id', userData.id).maybeSingle()
    : { data: null }

  // RPC fallback if business not found via RLS
  if (!biz) {
    const { data: rpcBiz } = await supabase.rpc('get_my_business').maybeSingle()
    if (rpcBiz) biz = rpcBiz
  }

  if (!biz) redirect('/register/business')

  const { data: vans } = await supabase.from('vans').select('id,name').eq('business_id', biz.id)
  const vanIds = (vans ?? []).map(v => v.id)
  const vanMap = Object.fromEntries((vans ?? []).map(v => [v.id, v.name]))

  const { data: orders } = vanIds.length
    ? await supabase.from('orders').select('*').in('van_id', vanIds).order('created_at', { ascending: false }).limit(100)
    : { data: [] }

  const groups = { Today: [], Yesterday: [], 'This Week': [], Older: [] }
  const now = new Date()
  for (const o of orders ?? []) {
    const d = new Date(o.created_at)
    const diffDays = Math.floor((now - d) / 86400000)
    if (diffDays === 0) groups.Today.push(o)
    else if (diffDays === 1) groups.Yesterday.push(o)
    else if (diffDays <= 7) groups['This Week'].push(o)
    else groups.Older.push(o)
  }

  return (
    <>
      <style>{`
        html,body{margin:0;padding:0}
        .biz-wrap{display:flex;flex-direction:column;min-height:100vh;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
        .biz-topbar{background:#fff;border-bottom:1px solid #e5e7eb;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
        .biz-sidebar{width:220px;flex-shrink:0;background:#fff;border-right:1px solid #e5e7eb;padding:16px 10px;min-height:calc(100vh - 56px)}
        .biz-main{flex:1;padding:24px;max-width:860px}
        .biz-body{display:flex;flex:1}
        .biz-bottom{display:none;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e5e7eb;z-index:100;padding:6px 0 18px}
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
          </div>

          <div className="biz-main">
            <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#111' }}>📦 Orders</h1>
            <p style={{ color:'#888', margin:'0 0 24px', fontSize:13 }}>{biz.name} — all recent orders</p>

            {(orders ?? []).length === 0 ? (
              <div style={{ textAlign:'center', padding:60, background:'#fff', borderRadius:14, boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>📦</div>
                <div style={{ fontWeight:700, fontSize:16, color:'#111' }}>No orders yet</div>
                <div style={{ color:'#888', fontSize:14, marginTop:6 }}>Orders will appear here when customers place them</div>
              </div>
            ) : (
              Object.entries(groups).map(([label, grpOrders]) => grpOrders.length === 0 ? null : (
                <div key={label} style={{ marginBottom:24 }}>
                  <h2 style={{ fontSize:13, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>{label}</h2>
                  <div style={{ background:'#fff', borderRadius:14, boxShadow:'0 1px 3px rgba(0,0,0,0.07)', overflow:'hidden' }}>
                    {grpOrders.map((o, i) => {
                      const s = STATUS_COLORS[o.status] ?? { bg:'#f3f4f6', color:'#555' }
                      return (
                        <div key={o.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', borderBottom: i < grpOrders.length-1 ? '1px solid #f3f4f6' : 'none', flexWrap:'wrap', gap:10 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontWeight:700, fontSize:14, color:'#111' }}>Order #{o.id?.slice(0,8).toUpperCase()}</div>
                            <div style={{ fontSize:12, color:'#888', marginTop:2 }}>
                              {vanMap[o.van_id] || 'Van'} · {new Date(o.created_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}
                            </div>
                          </div>
                          <span style={{ padding:'3px 12px', borderRadius:20, fontSize:12, fontWeight:700, background:s.bg, color:s.color, flexShrink:0 }}>{o.status}</span>
                          <span style={{ fontWeight:800, fontSize:16, color:'#111', flexShrink:0 }}>£{(o.total ?? 0).toFixed(2)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <nav className="biz-bottom">
          {NAV.slice(0,6).map(n => (
            <a key={n.href} href={n.href} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, textDecoration:'none', color: n.active ? '#f97316' : '#9ca3af', fontSize:10, fontWeight:600, minWidth:48 }}>
              <span style={{ fontSize:20 }}>{n.icon}</span>{n.label}
            </a>
          ))}
        </nav>
      </div>
    </>
  )
}
