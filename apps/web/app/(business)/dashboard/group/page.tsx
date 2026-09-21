// @ts-nocheck
// M10/M22 — a business's own view of group membership: pending
// invitations, current active membership, pending menu-template
// proposals addressed to it. Business-side only — no group_id in this
// route's path, resolved entirely from the caller's own businesses.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { MyGroupPanel } from '@/components/groups/MyGroupPanel'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Group — FoodTaxi' }

export default async function MyGroupPage() {
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
    <DashboardShell businessName={business.name} activeHref="/dashboard/group" title="Group" subtitle="Franchise / group membership for this business">
      <MyGroupPanel businessId={business.id} />
    </DashboardShell>
  )
}
