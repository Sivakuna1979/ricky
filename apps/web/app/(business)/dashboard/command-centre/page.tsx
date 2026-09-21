// @ts-nocheck
// K2 — the Command Centre entry page, same shell/auth pattern as every
// other Phase C+ dashboard page (see finance/page.tsx).
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { CommandCentreDashboard } from '@/components/commandCentre/CommandCentreDashboard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Command Centre — FoodTaxi' }

export default async function CommandCentrePage() {
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
    <DashboardShell businessName={business.name} activeHref="/dashboard/command-centre" title="Command Centre" subtitle="What needs attention today, across every part of the business">
      <CommandCentreDashboard />
    </DashboardShell>
  )
}
