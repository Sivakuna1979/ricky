// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

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

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  const isAdmin = profile?.role === 'super_admin' || profile?.role === 'admin' || user.email === 'sivakuna@icloud.com'
  if (!isAdmin) redirect('/dashboard')

  const stats = await getStats(supabase).catch(() => ({ totalUsers: 0, totalBusinesses: 0, totalOrders: 0, recentUsers: [], recentBusinesses: [] }))

  return (
    <div style={{ minHeight: '100vh', background: '#070b14', color: '#fff', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif' }}>
      {/* Top bar */}
      <div style={{ background: 'rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.08)', padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#f97316,#dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff' }}>FT</div>
          <span style={{ fontWeight: 800, fontSize: 16 }}>FoodTaxi <span style={{ color: '#fbbf24' }}>Admin</span></span>
          <span style={{ background: 'rgba(251,191,36,.15)', color: '#fbbf24', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, border: '1px solid rgba(251,191,36,.3)' }}>SUPER ADMIN</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.45)' }}>{user.email}</span>
          <a href="/" style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', textDecoration: 'none', padding: '6px 14px', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8 }}>← Site</a>
        </div>
      </div>

      <div style={{ display: 'flex' }}>
        {/* Sidebar */}
        <div style={{ width: 220, minHeight: 'calc(100vh - 60px)', background: 'rgba(255,255,255,.02)', borderRight: '1px solid rgba(255,255,255,.06)', padding: '24px 12px', flexShrink: 0 }}>
          {[
            { label: '📊 Dashboard',   href: '/admin/dashboard',           active: true  },
            { label: '👥 Users',       href: '/admin/users',               active: false },
            { label: '🚐 Businesses',  href: '/admin/businesses',          active: false },
            { label: '📦 Orders',      href: '/admin/orders',              active: false },
            { label: '⚙️ Settings',    href: '/admin/settings',            active: false },
          ].map(({ label, href, active }) => (
            <a key={href} href={href} style={{ display: 'block', padding: '10px 14px', borderRadius: 10, marginBottom: 4, fontSize: 14, fontWeight: 600, textDecoration: 'none', color: active ? '#fbbf24' : 'rgba(255,255,255,.55)', background: active ? 'rgba(251,191,36,.1)' : 'transparent', border: active ? '1px solid rgba(251,191,36,.2)' : '1px solid transparent' }}>
              {label}
            </a>
          ))}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, padding: 32, overflowX: 'hidden' }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 8px' }}>Dashboard Overview</h1>
          <p style={{ color: 'rgba(255,255,255,.4)', margin: '0 0 32px', fontSize: 14 }}>Welcome back, {user.email}</p>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 36 }}>
            {[
              { label: 'Total Users',      value: stats.totalUsers,      icon: '👥', color: '#6366f1' },
              { label: 'Businesses',       value: stats.totalBusinesses, icon: '🚐', color: '#f59e0b' },
              { label: 'Total Orders',     value: stats.totalOrders,     icon: '📦', color: '#10b981' },
            ].map(({ label, value, icon, color }) => (
              <div key={label} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: '20px 22px' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
                <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.45)', marginTop: 6 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Recent users */}
          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: 24, marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px' }}>Recent Users</h2>
            {stats.recentUsers.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,.3)', fontSize: 14 }}>No users yet</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                    {['ID', 'Role', 'Joined'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '0 0 10px', color: 'rgba(255,255,255,.35)', fontWeight: 600, fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.recentUsers.map((u: any) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      <td style={{ padding: '10px 0', color: 'rgba(255,255,255,.5)', fontFamily: 'monospace', fontSize: 12 }}>{u.id?.slice(0, 8)}…</td>
                      <td style={{ padding: '10px 0' }}>
                        <span style={{ background: u.role === 'super_admin' ? 'rgba(251,191,36,.15)' : 'rgba(255,255,255,.07)', color: u.role === 'super_admin' ? '#fbbf24' : 'rgba(255,255,255,.6)', fontSize: 12, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{u.role ?? 'customer'}</span>
                      </td>
                      <td style={{ padding: '10px 0', color: 'rgba(255,255,255,.4)', fontSize: 12 }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Recent businesses */}
          <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 20px' }}>Recent Businesses</h2>
            {stats.recentBusinesses.length === 0 ? (
              <p style={{ color: 'rgba(255,255,255,.3)', fontSize: 14 }}>No businesses yet</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                    {['Name', 'Status', 'Joined'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '0 0 10px', color: 'rgba(255,255,255,.35)', fontWeight: 600, fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.recentBusinesses.map((b: any) => (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      <td style={{ padding: '10px 0', fontWeight: 600 }}>{b.name ?? '—'}</td>
                      <td style={{ padding: '10px 0' }}>
                        <span style={{ background: b.status === 'active' ? 'rgba(16,185,129,.15)' : 'rgba(255,255,255,.07)', color: b.status === 'active' ? '#10b981' : 'rgba(255,255,255,.5)', fontSize: 12, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{b.status ?? 'pending'}</span>
                      </td>
                      <td style={{ padding: '10px 0', color: 'rgba(255,255,255,.4)', fontSize: 12 }}>{b.created_at ? new Date(b.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
