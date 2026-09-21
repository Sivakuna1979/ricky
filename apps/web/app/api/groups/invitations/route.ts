// @ts-nocheck
// M10 — a business owner/staff's view of pending group invitations
// addressed to any business they own/manage. Business-side, not
// group-side — uses my_business_ids()/my_staff_business_ids() (via RLS)
// not a group permission check, since the caller may not be any group's
// staff at all yet.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Session-scoped client — RLS on group_memberships already restricts
  // this to rows where business_id is one of the caller's own/staffed
  // businesses (or they're in the inviting group) — no admin client
  // needed here, and no business_id is ever trusted from the request.
  const { data } = await supabase.from('group_memberships').select('*, business_groups(id, name, type, branding), businesses(id, name)').eq('status', 'INVITED').order('invited_at', { ascending: false })
  return NextResponse.json(data ?? [])
}
