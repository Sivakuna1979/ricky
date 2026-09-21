// @ts-nocheck
// M78 — bulk operation history with per-business succeeded/failed/skipped
// results, for the Integration/Templates UI's "what happened when I
// published this" view.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveGroupContext } from '@/lib/groups/context'
import { hasGroupPermission } from '@/lib/groups/permissions'

export async function GET(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'view_group_audit')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data } = await admin.from('group_bulk_operations').select('*, group_bulk_operation_results(*)').eq('group_id', ctx.groupId).order('created_at', { ascending: false }).limit(50)
  return NextResponse.json(data ?? [])
}
