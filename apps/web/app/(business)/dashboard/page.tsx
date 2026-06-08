// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatCard } from '@/components/ui/StatCard'
import { LiveOrdersBoard } from '@/components/orders/LiveOrdersBoard'
import { VanStatusRow } from '@/components/van/VanStatusRow'
import { formatCurrency } from '@/lib/utils/format'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase.from('users').select('id, role').eq('auth_id', user.id).single()

  const { data: business } = await supabase
    .from('businesses')
    .select('*, subscriptions(status, trial_ends_at, subscription_plans(name))')
    .eq('owner_id', userData!.id)
    .single()

  if (!business) redirect('/register/business')

  const { data: vans } = await supabase
    .from('vans')
    .select('*')
    .eq('business_id', business.id)

  // Sales today
  const today = new Date().toISOString().split('T')[0]
  const { data: todayOrders } = await supabase
    .from('orders')
    .select('total, status')
    .in('van_id', (vans ?? []).map(v => v.id))
    .gte('created_at', `${today}T00:00:00`)
    .not('status', 'eq', 'cancelled')

  const todaySales = (todayOrders ?? []).reduce((s, o) => s + (o.total ?? 0), 0)
  const pendingOrders = (todayOrders ?? []).filter(o => ['pending', 'accepted', 'preparing'].includes(o.status)).length

  const liveVans = (vans ?? []).filter(v => v.tracking_status === 'live').length

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">{business.name}</p>
      </div>

      {/* Subscription Alert */}
      {(business.subscriptions as any)?.[0]?.status === 'trialing' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <p className="text-amber-800 text-sm">
            You&apos;re on a free trial. Upgrade to keep all features after your trial ends.
          </p>
          <a href="/dashboard/billing" className="text-amber-800 font-semibold underline text-sm">
            Upgrade now
          </a>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today's Sales" value={formatCurrency(todaySales)} icon="£" color="green" />
        <StatCard label="Orders Today" value={String(todayOrders?.length ?? 0)} icon="🛒" color="blue" />
        <StatCard label="Pending Orders" value={String(pendingOrders)} icon="⏳" color="orange" />
        <StatCard label="Vans Live" value={`${liveVans} / ${vans?.length ?? 0}`} icon="📍" color="brand" />
      </div>

      {/* Van Status */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Your Vans</h2>
        <div className="space-y-3">
          {(vans ?? []).map(van => (
            <VanStatusRow key={van.id} van={van} businessId={business.id} />
          ))}
          <a
            href="/dashboard/vans/new"
            className="block border-2 border-dashed border-gray-300 rounded-xl p-4 text-center text-gray-500 hover:border-brand-400 hover:text-brand-500 transition-colors"
          >
            + Add another van
          </a>
        </div>
      </div>

      {/* Live Orders */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Live Orders</h2>
        <LiveOrdersBoard vanIds={(vans ?? []).map(v => v.id)} />
      </div>
    </div>
  )
}
