// @ts-nocheck
// L25 — Integration Centre. Same business-resolution pattern as every
// other Phase K/L dashboard page (owner-first, then active staff row).
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { IntegrationCentre } from '@/components/integrations/IntegrationCentre'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Integrations — FoodTaxi' }

export default async function IntegrationsPage() {
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

  return (
    <DashboardShell businessName={business.name} activeHref="/dashboard/integrations" title="Integrations" subtitle="Payments, accounting, and everything connecting FoodTaxi to the outside world">
      <IntegrationCentre />
    </DashboardShell>
  )
}
