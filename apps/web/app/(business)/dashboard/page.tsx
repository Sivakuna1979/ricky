// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Business Dashboard — FoodTaxi' }

const PLAN_FEATURES: Record<string, string[]> = {
  starter: ['1 Van', 'QR Menu', 'GPS Tracking', 'Online Orders', 'Customer Reviews'],
  pro:     ['Up to 3 Vans', 'Everything in Starter', 'Priority Support', 'Analytics', 'Custom Menu'],
  premium: ['Unlimited Vans', 'Everything in Pro', 'Dedicated Manager', 'API Access', 'White Label'],
}

export default async function BusinessDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users').select('id, role').eq('auth_id', user.id).single()

  const { data: business } = await supabase
    .from('businesses')
    .select('*, subscriptions(status, trial_ends_at, subscription_plans(name, price))')
    .eq('owner_id', userData?.id)
    .maybeSingle()

  if (!business) redirect('/register/business')

  const { data: vans } = await supabase
    .from('vans').select('*').eq('business_id', business.id)

  const today = new Date().toISOString().split('T')[0]
  const vanIds = (vans ?? []).map(v => v.id)

  const { data: todayOrders } = vanIds.length
    ? await supabase.from('orders').select('id, total, status, created_at')
        .in('van_id', vanIds).gte('created_at', `${today}T00:00:00`).not('status', 'eq', 'cancelled')
    : { data: [] }

  const todaySales    = (todayOrders ?? []).reduce((s, o) => s + (o.total ?? 0), 0)
  const pendingOrders = (todayOrders ?? []).filter(o => ['pending','accepted','preparing'].includes(o.status)).length
  const liveVans      = (vans ?? []).filter(v => v.tracking_status === 'live').length

  const sub         = (business.subscriptions as any)?.[0]
  const planName    = sub?.subscription_plans?.name ?? 'starter'
  const subStatus   = sub?.status ?? 'active'
  const trialEnd    = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null
  const isTrialing  = subStatus === 'trialing'
  const features    = PLAN_FEATURES[planName.toLowerCase()] ?? PLAN_FEATURES.starter

  const NAV = [
    { icon: '📊', label: 'Dashboard',    href: '/dashboard',         active: true  },
    { icon: '🚐', label: 'My Vans',      href: '/dashboard/vans',    active: false },
    { icon: '📦', label: 'Orders',       href: '/dashboard/orders',  active: false },
    { icon: '🗺️', label: 'Tracking',     href: '/dashboard/tracking',active: false },
    { icon: '📋', label: 'Menu',         href: '/dashboard/menu',    active: false },
    { icon: '💳', label: 'My Plan',      href: '/dashboard/billing', active: false },
    { icon: '🎪', label: 'Events',       href: '/van/events',        active: false },
    { icon: '⚙️', label: 'Settings',     href: '/dashboard/settings',active: false },
  ]

  return (
    <>
      <style>{`
        html,body{margin:0;padding:0}
        .biz-wrap{display:flex;flex-direction:column;min-height:100vh;background:#f5f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
        .biz-topbar{background:#fff;border-bottom:1px solid #e5e7eb;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:100;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
        .biz-sidebar{width:220px;flex-shrink:0;background:#fff;border-right:1px solid #e5e7eb;padding:16px 10px;min-height:calc(100vh - 56px)}
        .biz-main{flex:1;padding:24px;overflow-x:hidden;max-width:900px}
        .biz-body{display:flex;flex:1}
        .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
        .biz-bottom{display:none;position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #e5e7eb;z-index:100;padding:6px 0 18px}
        @media(max-width:700px){
          .biz-sidebar{display:none}
          .biz-main{padding:16px 14px 90px}
          .biz-bottom{display:flex;justify-content:space-around}
          .stat-grid{grid-template-columns:1fr 1fr}
        }
      `}</style>

      <div className="biz-wrap">
        {/* Top bar */}
        <div className="biz-topbar">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#f97316,#dc2626)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:'#fff', flexShrink:0 }}>FT</div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#111', lineHeight:1 }}>FoodTaxi</div>
              <div style={{ fontSize:11, color:'#888' }}>{business.name}</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ background: isTrialing ? '#fef3c7' : '#d1fae5', color: isTrialing ? '#92400e' : '#065f46', fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, textTransform:'uppercase' }}>
              {isTrialing ? '⏳ Trial' : `✅ ${planName}`}
            </span>
            <a href="/" style={{ fontSize:12, color:'#6366f1', textDecoration:'none', padding:'5px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontWeight:600 }}>← Public Site</a>
          </div>
        </div>

        <div className="biz-body">
          {/* Sidebar */}
          <div className="biz-sidebar">
            {NAV.map(n => (
              <a key={n.href} href={n.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, marginBottom:3, fontSize:14, fontWeight:600, textDecoration:'none', color: n.active ? '#f97316' : '#555', background: n.active ? '#fff7ed' : 'transparent', border: n.active ? '1px solid #fed7aa' : '1px solid transparent' }}>
                <span style={{ fontSize:16 }}>{n.icon}</span>{n.label}
              </a>
            ))}
            <div style={{ margin:'16px 0 0', paddingTop:12, borderTop:'1px solid #f3f4f6' }}>
              <a href="/logout" style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, fontSize:13, fontWeight:600, textDecoration:'none', color:'#ef4444' }}>🚪 Sign Out</a>
            </div>
          </div>

          {/* Main content */}
          <div className="biz-main">
            <div style={{ marginBottom:24 }}>
              <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#111' }}>Dashboard</h1>
              <p style={{ color:'#888', margin:0, fontSize:13 }}>Welcome back — {business.name}</p>
            </div>

            {/* Trial banner */}
            {isTrialing && (
              <div style={{ background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:12, padding:'14px 18px', marginBottom:20, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14, color:'#92400e' }}>⏳ You're on a free trial</div>
                  {trialEnd && <div style={{ fontSize:12, color:'#b45309', marginTop:2 }}>Ends {trialEnd.toLocaleDateString('en-GB')}</div>}
                </div>
                <a href="/dashboard/billing" style={{ padding:'8px 18px', borderRadius:8, background:'#f59e0b', color:'#fff', fontWeight:700, fontSize:13, textDecoration:'none', whiteSpace:'nowrap' }}>Upgrade Now →</a>
              </div>
            )}

            {/* Stats */}
            <div className="stat-grid">
              {[
                { label: "Today's Sales",  value: `£${todaySales.toFixed(2)}`, icon: '💰', color: '#059669' },
                { label: 'Orders Today',   value: String(todayOrders?.length ?? 0), icon: '📦', color: '#3b82f6' },
                { label: 'Pending Orders', value: String(pendingOrders), icon: '⏳', color: '#f59e0b' },
                { label: 'Vans Live',      value: `${liveVans}/${vans?.length ?? 0}`, icon: '🚐', color: '#f97316' },
              ].map(s => (
                <div key={s.label} style={{ background:'#fff', borderRadius:12, padding:'16px 18px', boxShadow:'0 1px 3px rgba(0,0,0,0.07)' }}>
                  <div style={{ fontSize:24, marginBottom:4 }}>{s.icon}</div>
                  <div style={{ fontSize:22, fontWeight:800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize:12, color:'#888', marginTop:2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* My Plan */}
            <div style={{ background:'#fff', borderRadius:14, padding:'20px 22px', boxShadow:'0 1px 3px rgba(0,0,0,0.07)', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase', marginBottom:4 }}>Current Plan</div>
                  <div style={{ fontSize:20, fontWeight:800, color:'#111' }}>{planName.charAt(0).toUpperCase() + planName.slice(1)} Plan</div>
                  <div style={{ fontSize:13, color:'#888', marginTop:2 }}>Status: <span style={{ color: subStatus === 'active' ? '#059669' : '#f59e0b', fontWeight:700 }}>{subStatus}</span></div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <a href="/dashboard/billing" style={{ padding:'9px 18px', borderRadius:10, background:'#f97316', color:'#fff', fontSize:13, fontWeight:700, textDecoration:'none' }}>Manage Plan</a>
                </div>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:14 }}>
                {features.map(f => (
                  <span key={f} style={{ padding:'4px 12px', borderRadius:20, background:'#f0fdf4', color:'#065f46', fontSize:12, fontWeight:600, border:'1px solid #bbf7d0' }}>✓ {f}</span>
                ))}
              </div>
            </div>

            {/* My Vans */}
            <div style={{ background:'#fff', borderRadius:14, padding:'20px 22px', boxShadow:'0 1px 3px rgba(0,0,0,0.07)', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <h2 style={{ fontSize:16, fontWeight:700, color:'#111', margin:0 }}>My Vans</h2>
                <a href="/dashboard/vans" style={{ fontSize:13, color:'#6366f1', fontWeight:600, textDecoration:'none' }}>Manage →</a>
              </div>
              {(vans ?? []).length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px 0' }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>🚐</div>
                  <div style={{ fontSize:14, color:'#888', marginBottom:12 }}>No vans added yet</div>
                  <a href="/dashboard/vans/new" style={{ padding:'9px 20px', borderRadius:10, background:'#f97316', color:'#fff', fontSize:13, fontWeight:700, textDecoration:'none' }}>+ Add Your First Van</a>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {(vans ?? []).map(van => (
                    <div key={van.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:10, background:'#f9fafb', border:'1px solid #e5e7eb' }}>
                      <div style={{ width:10, height:10, borderRadius:'50%', background: van.tracking_status === 'live' ? '#10b981' : '#d1d5db', flexShrink:0 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:14, color:'#111' }}>{van.name || 'Unnamed Van'}</div>
                        <div style={{ fontSize:12, color:'#888' }}>{van.van_type || 'Van'} · {van.tracking_status === 'live' ? '🟢 Live' : '⚫ Offline'}</div>
                      </div>
                      <a href={`/dashboard/vans/${van.id}`} style={{ fontSize:12, color:'#6366f1', fontWeight:600, textDecoration:'none' }}>Edit →</a>
                    </div>
                  ))}
                  <a href="/dashboard/vans/new" style={{ display:'block', padding:'12px', borderRadius:10, border:'2px dashed #e5e7eb', textAlign:'center', color:'#888', fontSize:13, fontWeight:600, textDecoration:'none' }}>+ Add another van</a>
                </div>
              )}
            </div>

            {/* Recent Orders */}
            <div style={{ background:'#fff', borderRadius:14, padding:'20px 22px', boxShadow:'0 1px 3px rgba(0,0,0,0.07)', marginBottom:20 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <h2 style={{ fontSize:16, fontWeight:700, color:'#111', margin:0 }}>Today's Orders</h2>
                <a href="/dashboard/orders" style={{ fontSize:13, color:'#6366f1', fontWeight:600, textDecoration:'none' }}>View all →</a>
              </div>
              {(todayOrders ?? []).length === 0 ? (
                <div style={{ textAlign:'center', padding:'20px 0', color:'#bbb', fontSize:14 }}>No orders today yet</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {(todayOrders ?? []).slice(0,5).map(o => (
                    <div key={o.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 12px', borderRadius:8, background:'#f9fafb' }}>
                      <span style={{ fontSize:13, color:'#555', fontFamily:'monospace' }}>{o.id?.slice(0,8)}…</span>
                      <span style={{
                        padding:'2px 10px', borderRadius:10, fontSize:11, fontWeight:700,
                        background: o.status === 'completed' ? '#d1fae5' : o.status === 'pending' ? '#fef3c7' : '#eff6ff',
                        color: o.status === 'completed' ? '#059669' : o.status === 'pending' ? '#b45309' : '#3b82f6',
                      }}>{o.status}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:'#111' }}>£{(o.total ?? 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Event Opportunities */}
            <div style={{ background:'linear-gradient(135deg,#1e1b4b,#312e81)', borderRadius:14, padding:'20px 22px', color:'#fff' }}>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>🎪 Event Opportunities</div>
              <p style={{ fontSize:13, color:'rgba(255,255,255,0.65)', margin:'0 0 14px', lineHeight:1.6 }}>
                FoodTaxi publishes event catering jobs for registered vans. Check the board to find events near you and apply.
              </p>
              <a href="/van/events" style={{ display:'inline-block', padding:'9px 20px', borderRadius:10, background:'#f97316', color:'#fff', fontWeight:700, fontSize:13, textDecoration:'none' }}>
                View Event Board →
              </a>
            </div>
          </div>
        </div>

        {/* Mobile bottom nav */}
        <nav className="biz-bottom">
          {NAV.slice(0, 6).map(n => (
            <a key={n.href} href={n.href} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, textDecoration:'none', color: n.active ? '#f97316' : '#9ca3af', fontSize:10, fontWeight:600, minWidth:48 }}>
              <span style={{ fontSize:20 }}>{n.icon}</span>
              {n.label}
            </a>
          ))}
        </nav>
      </div>
    </>
  )
}
