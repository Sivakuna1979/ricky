// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { AutomationsCentre } from '@/components/automations/AutomationsCentre'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Automations — FoodTaxi' }

export default async function AutomationsPage() {
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
    <DashboardShell businessName={business.name} activeHref="/dashboard/automations" title="Automations" subtitle="Alerts, reminders and reports FoodTaxi runs for you">
      <AutomationsCentre />
    </DashboardShell>
  )
}
