// @ts-nocheck
// M12 — /group/dashboard. A standalone area (not the business
// DashboardShell — a group is a different scope from a business, per the
// Core Security Principle: group membership never implies business
// access, so this deliberately doesn't reuse the business nav).
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GroupDashboard } from '@/components/groups/GroupDashboard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Group Dashboard — FoodTaxi' }

export default async function GroupDashboardPage({ searchParams }: { searchParams: { group_id?: string } }) {
  const supabase = await createClient()
  const { data: { user }, error: userErr } = await supabase.auth.getUser()
  if (userErr || !user) redirect('/login')

  const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  if (!userData?.id) redirect('/login')

  const [{ data: owned }, { data: staffed }] = await Promise.all([
    supabase.from('business_groups').select('id, name').eq('owner_user_id', userData.id),
    supabase.from('group_staff').select('group_id, business_groups(id, name)').eq('user_id', userData.id).eq('is_active', true),
  ])
  const groups = [
    ...(owned ?? []).map((g: any) => g),
    ...(staffed ?? []).filter((s: any) => s.business_groups).map((s: any) => s.business_groups),
  ]
  const byId = new Map(groups.map((g: any) => [g.id, g]))
  const uniqueGroups = [...byId.values()]

  if (!uniqueGroups.length) redirect('/group/new')
  const activeGroupId = searchParams.group_id && byId.has(searchParams.group_id) ? searchParams.group_id : uniqueGroups[0].id

  return <GroupDashboard groups={uniqueGroups} activeGroupId={activeGroupId} />
}
