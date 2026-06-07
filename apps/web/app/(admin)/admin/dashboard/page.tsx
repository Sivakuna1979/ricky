import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatCard } from '@/components/ui/StatCard'
import { formatCurrency } from '@/lib/utils/format'
import Link from 'next/link'

export const metadata = { title: 'Super Admin Dashboard' }

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase.from('users').select('role').eq('auth_id', user.id).single()
  if (userData?.role !== 'super_admin') redirect('/dashboard')

  const [
    { count: totalBusinesses },
    { count: pendingBusinesses },
    { count: totalVans },
    { count: liveVans },
    { count: totalOrders },
    { data: activeSubscriptions },
    { count: totalLeads },
  ] = await Promise.all([
    supabase.from('businesses').select('*', { count: 'exact', head: true }),
    supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('vans').select('*', { count: 'exact', head: true }),
    supabase.from('vans').select('*', { count: 'exact', head: true }).eq('tracking_status', 'live'),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('subscriptions').select('*, subscription_plans(price_monthly)').in('status', ['active', 'trialing']),
    supabase.from('leads').select('*', { count: 'exact', head: true }),
  ])

  const mrr = (activeSubscriptions ?? []).reduce((sum: number, s: any) => {
    return sum + (s.subscription_plans?.price_monthly ?? 0)
  }, 0)

  const { data: pendingBusinessList } = await supabase
    .from('businesses')
    .select('id, name, business_type, created_at, owner_id, users!businesses_owner_id_fkey(full_name, email)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
        <p className="text-gray-500">Platform overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Businesses" value={String(totalBusinesses ?? 0)} icon="🏢" color="blue" />
        <StatCard label="Live Vans Now" value={String(liveVans ?? 0)} icon="📍" color="green" />
        <StatCard label="Total Orders" value={String(totalOrders ?? 0)} icon="🛒" color="brand" />
        <StatCard label="MRR" value={formatCurrency(mrr)} icon="£" color="green" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Pending Approval" value={String(pendingBusinesses ?? 0)} icon="⏳" color="orange" />
        <StatCard label="Total Vans" value={String(totalVans ?? 0)} icon="🚐" color="blue" />
        <StatCard label="Active Subscriptions" value={String(activeSubscriptions?.length ?? 0)} icon="💳" color="brand" />
        <StatCard label="Sales Leads" value={String(totalLeads ?? 0)} icon="🎯" color="orange" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { href: '/admin/businesses', label: 'Manage Businesses', icon: '🏢' },
          { href: '/admin/vans/live', label: 'Live Van Map', icon: '🗺️' },
          { href: '/admin/discovery', label: 'Business Discovery', icon: '🔍' },
          { href: '/admin/leads', label: 'Sales Leads', icon: '🎯' },
        ].map(action => (
          <Link key={action.href} href={action.href}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex items-center gap-3">
            <span className="text-2xl">{action.icon}</span>
            <span className="font-medium text-gray-700 text-sm">{action.label}</span>
          </Link>
        ))}
      </div>

      {/* Pending Businesses */}
      {(pendingBusinessList?.length ?? 0) > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Pending Approval</h2>
            <Link href="/admin/businesses?status=pending" className="text-sm text-brand-500 hover:underline">View all</Link>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {pendingBusinessList!.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium text-gray-900">{b.name}</p>
                  <p className="text-sm text-gray-500">{(b.users as any)?.email}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/admin/businesses/${b.id}`}
                    className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600">
                    Review
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
