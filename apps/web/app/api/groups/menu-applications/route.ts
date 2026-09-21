// @ts-nocheck
// M22 — a business's own view of pending menu-template proposals
// addressed to it, across whichever group it's a member of. Session
// client only — RLS on group_menu_template_applications already scopes
// this to rows where business_id is the caller's own/staffed business.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase.from('group_menu_template_applications')
    .select('*, group_menu_templates(name, group_id, business_groups(name)), group_menu_template_versions(version_number)')
    .eq('status', 'PENDING').order('proposed_at', { ascending: false })
  return NextResponse.json(data ?? [])
}
