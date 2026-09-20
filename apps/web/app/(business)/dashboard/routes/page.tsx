// @ts-nocheck
// Route Intelligence dashboard (G12: "Suggested route: /dashboard/routes").
// Server page resolves the business + van list; all data fetching for the
// three tabs (Sessions, Performance, Demand & Loading) happens client-side
// against the Phase G API routes already built.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { RouteIntelligence } from '@/components/routes/RouteIntelligence'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Route Intelligence — FoodTaxi' }

export default async function RoutesPage() {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) redirect('/login')

  const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  let business: any = null
  if (userData?.id) {
    const { data: b } = await supabase.from('businesses').select('id, name').eq('owner_id', userData.id).maybeSingle()
    business = b
  }
  if (!business) {
    const { data: staffRows } = await supabase.from('staff').select('business_id, businesses(id, name)').eq('user_id', userData?.id).eq('is_active', true).limit(1)
    business = staffRows?.[0]?.businesses ?? null
  }
  if (!business) redirect('/register/business')

  const { data: myVanIdsRows } = await supabase.rpc('my_van_ids')
  const myVanIds = (myVanIdsRows ?? []).map((v: any) => (typeof v === 'string' ? v : v.my_van_ids ?? v.id))
  const { data: vans } = myVanIds.length
    ? await supabase.from('vans').select('id, name').eq('business_id', business.id).in('id', myVanIds)
    : { data: [] }

  return (
    <DashboardShell businessName={business.name} activeHref="/dashboard/routes" title="Route Intelligence" subtitle="Route sessions, stop performance and demand planning">
      <RouteIntelligence vans={vans ?? []} />
    </DashboardShell>
  )
}
