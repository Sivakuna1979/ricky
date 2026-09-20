// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Analytics — FoodTaxi' }

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) redirect('/login')

  let { data: userData } = await supabase
    .from('users').select('id, role').eq('auth_id', user.id).maybeSingle()

  let business: any = null
  try {
    if (userData?.id) {
      const { data: b } = await supabase.from('businesses').select('id, name').eq('owner_id', userData.id).maybeSingle()
      business = b
    }
    if (!business) { const { data: r } = await supabase.rpc('get_my_business'); if (r) business = r }
  } catch (_e) {}
  if (!business) redirect('/register/business')

  const NAV = [
    { icon: '📊', label: 'Dashboard',  href: '/dashboard',          active: false },
    { icon: '🚐', label: 'My Vans',    href: '/dashboard/vans',     active: false },
    { icon: '📦', label: 'Orders',     href: '/dashboard/orders',   active: false },
    { icon: '🧾', label: 'POS',        href: '/dashboard/pos',      active: false },
    { icon: '🍳', label: 'Kitchen',    href: '/dashboard/kitchen',  active: false },
    { icon: '📋', label: 'Menu',       href: '/dashboard/menu',     active: false },
    { icon: '🤖', label: 'FoodTaxi AI', href: '/dashboard/ai',      active: false },
    { icon: '🧠', label: 'Memory',     href: '/dashboard/memory',   active: false },
    { icon: '📦', label: 'Stock',      href: '/dashboard/stock',    active: false },
    { icon: '🚚', label: 'Suppliers',  href: '/dashboard/suppliers',active: false },
    { icon: '👥', label: 'Team',       href: '/dashboard/team',     active: false },
    { icon: '🔧', label: 'Fleet',      href: '/dashboard/fleet',    active: false },
    { icon: '🔔', label: 'Notifications', href: '/dashboard/notifications', active: false },
    { icon: '⚡', label: 'Automations', href: '/dashboard/automations', active: false },
    { icon: '📈', label: 'Analytics',  href: '/dashboard/analytics',active: true  },
    { icon: '💳', label: 'My Plan',    href: '/dashboard/billing',  active: false },
    { icon: '🎪', label: 'Events',     href: '/van/events',         active: false },
    { icon: '🧼', label: 'Hygiene',    href: '/dashboard/hygiene',  active: false },
    { icon: '💬', label: 'WhatsApp',   href: '/dashboard/whatsapp', active: false },
    { icon: '📣', label: 'Marketing', href: '/dashboard/marketing' },
    { icon: '⚙️', label: 'Settings',  href: '/dashboard/settings', active: false },
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
        .pub-site-link{display:inline-block}@media(max-width:700px){.biz-sidebar{display:none}.biz-main{padding:16px 14px 90px}.pub-site-link{display:none}}
      `}</style>
      <div className="biz-wrap">
        <div className="biz-topbar">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#f97316,#dc2626)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:900, color:'#fff' }}>FT</div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#111', lineHeight:1 }}>FoodTaxi</div>
              <div style={{ fontSize:11, color:'#888' }}>{business.name}</div>
            </div>
          </div>
          <a href="/" className="pub-site-link" style={{ fontSize:12, color:'#6366f1', textDecoration:'none', padding:'5px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontWeight:600 }}>← Public Site</a>
        </div>
        <div className="biz-body">
          <div className="biz-sidebar">
            {NAV.map(n => (
              <a key={n.href} href={n.href} style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, marginBottom:3, fontSize:14, fontWeight:600, textDecoration:'none', color: n.active ? '#f97316' : '#555', background: n.active ? '#fff7ed' : 'transparent', border: n.active ? '1px solid #fed7aa' : '1px solid transparent' }}>
                <span style={{ fontSize:16 }}>{n.icon}</span>{n.label}
              </a>
            ))}
            <div style={{ margin:'16px 0 0', paddingTop:12, borderTop:'1px solid #f3f4f6' }}>
              <a href="/api/auth/logout" style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, fontSize:13, fontWeight:600, textDecoration:'none', color:'#ef4444' }}>🚪 Sign Out</a>
            </div>
          </div>
          <div className="biz-main">
            <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px', color:'#111' }}>Analytics</h1>
            <p style={{ color:'#888', margin:'0 0 24px', fontSize:13 }}>How your business is performing</p>
            <AnalyticsDashboard businessId={business.id} />
          </div>
        </div>
      </div>
    </>
  )
}
