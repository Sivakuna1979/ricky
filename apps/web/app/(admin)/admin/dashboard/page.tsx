// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const metadata = { title: 'Super Admin Dashboard' }

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const ownerEmail = process.env.SUPER_ADMIN_EMAIL ?? 'sivakuna@icloud.com'
  const { data: userData } = await supabase.from('users').select('role, full_name').eq('auth_id', user.id).single()
  const isAdmin = userData?.role === 'super_admin' || userData?.role === 'admin' || user.email === ownerEmail
  if (!isAdmin) redirect('/login')

  // Safe counts — return 0 if table missing or RLS blocks
  const safeCount = async (table: string, filter?: Record<string, string>) => {
    try {
      let q = supabase.from(table).select('*', { count: 'exact', head: true })
      if (filter) Object.entries(filter).forEach(([k, v]) => { q = q.eq(k, v) })
      const { count } = await q
      return count ?? 0
    } catch { return 0 }
  }

  const [businesses, pending, vans, liveVans, orders, users, events] = await Promise.all([
    safeCount('businesses'),
    safeCount('businesses', { status: 'pending' }),
    safeCount('vans'),
    safeCount('vans', { tracking_status: 'live' }),
    safeCount('orders'),
    safeCount('users'),
    safeCount('event_bookings', { status: 'pending' }),
  ])

  const adminName = userData?.full_name ?? user.email ?? 'Admin'

  const stats = [
    { label: 'Total Businesses', value: businesses, icon: '🏢', color: '#3b82f6' },
    { label: 'Pending Approval', value: pending, icon: '⏳', color: '#f59e0b' },
    { label: 'Total Vans', value: vans, icon: '🚐', color: '#8b5cf6' },
    { label: 'Live Now', value: liveVans, icon: '📍', color: '#10b981' },
    { label: 'Total Orders', value: orders, icon: '🛒', color: '#06b6d4' },
    { label: 'Total Users', value: users, icon: '👥', color: '#f97316' },
    { label: 'Event Requests', value: events, icon: '🎪', color: '#ec4899' },
    { label: 'MRR', value: '—', icon: '£', color: '#10b981' },
  ]

  const navItems = [
    { href: '/admin/businesses', label: 'Businesses', icon: '🏢' },
    { href: '/admin/businesses/pending', label: 'Pending', icon: '⏳' },
    { href: '/admin/users', label: 'Users', icon: '👥' },
    { href: '/admin/vans', label: 'Live Vans', icon: '🗺️' },
    { href: '/admin/orders', label: 'Orders', icon: '🛒' },
    { href: '/admin/events', label: 'Event Bookings', icon: '🎪' },
    { href: '/admin/subscriptions', label: 'Subscriptions', icon: '💳' },
    { href: '/admin/leads', label: 'Sales Leads', icon: '🎯' },
    { href: '/admin/menus', label: 'Price Lists', icon: '🍽️' },
    { href: '/admin/reports', label: 'Reports', icon: '📈' },
    { href: '/admin/settings', label: 'Settings', icon: '⚙️' },
  ]

  return (
    <div style={{ minHeight:'100vh', background:'#070b14', color:'#fff', fontFamily:"var(--font-inter),-apple-system,sans-serif", padding:'0' }}>

      {/* Header */}
      <div style={{ background:'#0d1220', borderBottom:'1px solid rgba(255,255,255,.07)', padding:'16px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#f97316,#dc2626)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ color:'#fff', fontSize:13, fontWeight:900 }}>FT</span>
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:'#fff' }}>Food<span style={{ color:'#f97316' }}>Taxi</span> <span style={{ color:'#fbbf24', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em' }}>Super Admin</span></div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.4)' }}>Welcome, {adminName}</div>
          </div>
        </div>
        <Link href="/" style={{ fontSize:12, color:'rgba(255,255,255,.3)', textDecoration:'none' }}>← View Site</Link>
      </div>

      <div style={{ padding:'24px', maxWidth:1200, margin:'0 auto' }}>

        {/* Stats */}
        <h2 style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,.3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:16 }}>Platform Overview</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:12, marginBottom:32 }}>
          {stats.map(s => (
            <div key={s.label} style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.07)', borderRadius:14, padding:'16px 18px' }}>
              <div style={{ fontSize:24, marginBottom:6 }}>{s.icon}</div>
              <div style={{ fontSize:28, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,.4)', marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Nav */}
        <h2 style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,.3)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:16 }}>Manage</h2>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:10 }}>
          {navItems.map(item => (
            <Link key={item.href} href={item.href} style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:12, padding:'16px', textDecoration:'none', display:'flex', alignItems:'center', gap:10, color:'rgba(255,255,255,.7)', fontSize:13, fontWeight:600, transition:'all .15s' }}>
              <span style={{ fontSize:20 }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
