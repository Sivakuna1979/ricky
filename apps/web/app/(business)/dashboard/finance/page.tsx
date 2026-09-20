// @ts-nocheck
// Finance dashboard (H4–H6: "Create /dashboard/finance, mobile-first").
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { FinanceDashboard } from '@/components/finance/FinanceDashboard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Finance — FoodTaxi' }

export default async function FinancePage() {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) redirect('/login')

  const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  let business: any = null
  if (userData?.id) {
    const { data: b } = await supabase.from('businesses').select('id, name, currency').eq('owner_id', userData.id).maybeSingle()
    business = b
  }
  if (!business) {
    const { data: staffRows } = await supabase.from('staff').select('business_id, businesses(id, name, currency)').eq('user_id', userData?.id).eq('is_active', true).limit(1)
    business = staffRows?.[0]?.businesses ?? null
  }
  if (!business) redirect('/register/business')

  const { data: myVanIdsRows } = await supabase.rpc('my_van_ids')
  const myVanIds = (myVanIdsRows ?? []).map((v: any) => (typeof v === 'string' ? v : v.my_van_ids ?? v.id))
  const { data: vans } = myVanIds.length
    ? await supabase.from('vans').select('id, name').eq('business_id', business.id).in('id', myVanIds)
    : { data: [] }

  const { data: suppliers } = await supabase.from('supplier_records').select('id, supplier_name').eq('business_id', business.id).eq('is_active', true)

  return (
    <DashboardShell businessName={business.name} activeHref="/dashboard/finance" title="Finance" subtitle="Sales, expenses, reconciliation, VAT and reports">
      <FinanceDashboard vans={vans ?? []} suppliers={suppliers ?? []} currency={business.currency ?? 'GBP'} />
    </DashboardShell>
  )
}
