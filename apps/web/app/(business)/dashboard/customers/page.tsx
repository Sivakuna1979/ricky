// @ts-nocheck
// I4/I54 — the CRM/Growth dashboard: customer list/profile, loyalty
// configuration, promotions/vouchers, campaigns and reviews.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { CrmDashboard } from '@/components/crm/CrmDashboard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Customers — FoodTaxi' }

export default async function CustomersPage() {
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

  const { data: vans } = await supabase.from('vans').select('id, name').eq('business_id', business.id)

  return (
    <DashboardShell businessName={business.name} activeHref="/dashboard/customers" title="Customers" subtitle="CRM, loyalty, promotions, campaigns and reviews">
      <CrmDashboard vans={vans ?? []} currency={business.currency ?? 'GBP'} />
    </DashboardShell>
  )
}
