// @ts-nocheck
// K54 — an optional, private, printable/exportable owner report. Reuses
// the exact same /api/command-centre/* data the dashboard tabs use (no
// new computation), presented in a clean single-page, print-friendly
// layout — window.print() (save as PDF) rather than a new PDF-generation
// dependency, consistent with this app not otherwise using one anywhere.
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { OwnerReport } from '@/components/commandCentre/OwnerReport'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Owner Report — FoodTaxi' }

export default async function OwnerReportPage() {
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
    <DashboardShell businessName={business.name} activeHref="/dashboard/command-centre" title="Owner Report" subtitle="A private, printable summary — not shared automatically">
      <OwnerReport businessName={business.name} />
    </DashboardShell>
  )
}
