// @ts-nocheck
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

async function getStats(supabase: any) {
  const [users, businesses, orders] = await Promise.all([
    supabase.from('users').select('id, role, created_at', { count: 'exact' }),
    supabase.from('businesses').select('id, name, status, created_at', { count: 'exact' }),
    supabase.from('orders').select('id, status, total, created_at', { count: 'exact' }),
  ])
  return {
    totalUsers: users.count ?? 0,
    totalBusinesses: businesses.count ?? 0,
    totalOrders: orders.count ?? 0,
    recentUsers: (users.data ?? []).slice(-5).reverse(),
    recentBusinesses: (businesses.data ?? []).slice(-5).reverse(),
  }
}

const NAV = [
  { label: 'Dashboard',  icon: '📊', href: '/admin/dashboard' },
  { label: 'Homepage',   icon: '🏠', href: '/admin/homepage'  },
  { label: 'Users',      icon: '👥', href: '/admin/users'     },
  { label: 'Businesses', icon: '🚐', href: '/admin/businesses'},
  { label: 'Orders',     icon: '📦', href: '/admin/orders'    },
  { label: 'Settings',   icon: '⚙️', href: '/admin/settings'  },
  { label: 'Discovery',  icon: '🔍', href: '/admin/discovery' },
]

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
  const stats = await getStats(supabase).catch(() => ({ totalUsers: 0, totalBusinesses: 0, totalOrders: 0, recentUsers: [], recentBusinesses: [] }))

  return (
    <>
      <style>{`
        html,body{margin:0;padding:0}
        .adm-wrap{display:flex;flex-direction:column;min-height:100vh;background:#070b14;color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif}
        /* sidebar visible on desktop, hidden on mobile */
        .adm-sidebar{width:200px;flex-shrink:0;background:rgba(255,255,255,.02);border-right:1px solid rgba(255,255,255,.06);padding:20px 10px}
        /* bottom nav on mobile */
        .adm-bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:#0d1117;border-top:1px solid rgba(255,255,255,.08);z-index:50;padding:8px 0 20px}
        .adm-main{flex:1;padding:20px;overflow-x:hidden}
        .adm-body{display:flex;flex:1}
        .stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
        @media(max-width:640px){
          .adm-sidebar{display:none}
          .adm-bottom-nav{display:flex;justify-content:space-around;align-items:center}
          .adm-main{padding:16px 14px 90px}
          .stat-grid{grid-template-columns:1fr}
          .adm-topbar-email{display:none}
        }
      `}</style>

      <div className="adm-wrap">
        {/* Top bar */}
        <div style={{ background:'rgba(255,255,255,.04)', borderBottom:'1px solid rgba(255,255,255,.08)', padding:'0 16px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:'linear-gradient(135deg,#f97316,#dc2626)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:900, color:'#fff', flexShrink:0 }}>FT</div>
            <span style={{ fontWeight:800, fontSize:15 }}>FoodTaxi <span style={{ color:'#fbbf24' }}>Admin</span></span>
            <span style={{ background:'rgba(251,191,36,.15)', color:'#fbbf24', fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20, border:'1px solid rgba(251,191,36,.3)', whiteSpace:'nowrap' }}>SUPER ADMIN</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span className="adm-topbar-email" style={{ fontSize:12, color:'rgba(255,255,255,.4)' }}>{user?.email ?? 'Admin'}</span>
            <a href="/" style={{ fontSize:12, color:'rgba(255,255,255,.5)', textDecoration:'none', padding:'5px 12px', border:'1px solid rgba(255,255,255,.12)', borderRadius:8, whiteSpace:'nowrap' }}>← Site</a>
          </div>
        </div>

        <div className="adm-body">
          {/* Desktop sidebar */}
          <div className="adm-sidebar">
            {NAV.map(({ label, icon, href }) => {
              const active = href === '/admin/dashboard'
              return (
                <a key={href} href={href} style={{ display:'flex', alignItems:'center', gap:9, padding:'10px 12px', borderRadius:10, marginBottom:3, fontSize:14, fontWeight:600, textDecoration:'none', color: active ? '#fbbf24' : 'rgba(255,255,255,.55)', background: active ? 'rgba(251,191,36,.1)' : 'transparent', border: active ? '1px solid rgba(251,191,36,.2)' : '1px solid transparent' }}>
                  <span>{icon}</span>{label}
                </a>
              )
            })}
          </div>

          {/* Main content */}
          <div className="adm-main">
            <h1 style={{ fontSize:22, fontWeight:800, margin:'0 0 4px' }}>Dashboard Overview</h1>
            <p style={{ color:'rgba(255,255,255,.4)', margin:'0 0 24px', fontSize:13 }}>Welcome back, {user?.email ?? 'Admin'}</p>

            {/* Stat cards */}
            <div className="stat-grid">
              {[
                { label:'Total Users',  value:stats.totalUsers,      icon:'👥', color:'#6366f1' },
                { label:'Businesses',   value:stats.totalBusinesses, icon:'🚐', color:'#f59e0b' },
                { label:'Total Orders', value:stats.totalOrders,     icon:'📦', color:'#10b981' },
              ].map(({ label, value, icon, color }) => (
                <div key={label} style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:14, padding:'18px 20px', display:'flex', alignItems:'center', gap:16 }}>
                  <span style={{ fontSize:28 }}>{icon}</span>
                  <div>
                    <div style={{ fontSize:28, fontWeight:800, color, lineHeight:1 }}>{value}</div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,.4)', marginTop:4 }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent users */}
            <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:14, padding:'18px 20px', marginBottom:16 }}>
              <h2 style={{ fontSize:15, fontWeight:700, margin:'0 0 16px' }}>Recent Users</h2>
              {stats.recentUsers.length === 0 ? (
                <p style={{ color:'rgba(255,255,255,.3)', fontSize:14, margin:0 }}>No users yet</p>
              ) : stats.recentUsers.map((u: any) => (
                <div key={u.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
                  <span style={{ color:'rgba(255,255,255,.5)', fontFamily:'monospace', fontSize:12 }}>{u.id?.slice(0,8)}…</span>
                  <span style={{ background: u.role === 'super_admin' ? 'rgba(251,191,36,.15)' : 'rgba(255,255,255,.07)', color: u.role === 'super_admin' ? '#fbbf24' : 'rgba(255,255,255,.6)', fontSize:11, padding:'2px 8px', borderRadius:20, fontWeight:600 }}>{u.role ?? 'customer'}</span>
                  <span style={{ color:'rgba(255,255,255,.35)', fontSize:11 }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</span>
                </div>
              ))}
            </div>

            {/* Recent businesses */}
            <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:14, padding:'18px 20px' }}>
              <h2 style={{ fontSize:15, fontWeight:700, margin:'0 0 16px' }}>Recent Businesses</h2>
              {stats.recentBusinesses.length === 0 ? (
                <p style={{ color:'rgba(255,255,255,.3)', fontSize:14, margin:0 }}>No businesses yet</p>
              ) : stats.recentBusinesses.map((b: any) => (
                <div key={b.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
                  <span style={{ fontWeight:600, fontSize:14 }}>{b.name ?? '—'}</span>
                  <span style={{ background: b.status === 'active' ? 'rgba(16,185,129,.15)' : 'rgba(255,255,255,.07)', color: b.status === 'active' ? '#10b981' : 'rgba(255,255,255,.5)', fontSize:11, padding:'2px 8px', borderRadius:20, fontWeight:600 }}>{b.status ?? 'pending'}</span>
                  <span style={{ color:'rgba(255,255,255,.35)', fontSize:11 }}>{b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile bottom nav */}
        <nav className="adm-bottom-nav">
          {NAV.map(({ label, icon, href }) => {
            const active = href === '/admin/dashboard'
            return (
              <a key={href} href={href} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, textDecoration:'none', color: active ? '#fbbf24' : 'rgba(255,255,255,.4)', fontSize:10, fontWeight:600, minWidth:52 }}>
                <span style={{ fontSize:20 }}>{icon}</span>
                {label}
              </a>
            )
          })}
        </nav>
      </div>
    </>
  )
}
