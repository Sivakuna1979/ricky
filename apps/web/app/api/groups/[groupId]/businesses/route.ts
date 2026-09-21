// @ts-nocheck
// M39/M73 — a search-to-invite helper for manage_group_members. This
// NEVER adds a business to the group by itself — it only returns
// candidate businesses (matched by name text, id, or slug) for a human to
// pick from, so the actual invite (POST /members) always references a
// specific, unambiguous business id chosen by a person, never a fuzzy
// name match applied automatically. This is the "existing claim flow
// keys off an id, never a name string" precedent applied to group invites.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveGroupContext } from '@/lib/groups/context'
import { hasGroupPermission } from '@/lib/groups/permissions'

export async function GET(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'manage_group_members')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  const admin = await createAdminClient()
  const { data: candidates } = await admin.from('businesses').select('id, name, city, postcode, status').or(`name.ilike.%${q}%,slug.ilike.%${q}%`).limit(10)
  const { data: existing } = await admin.from('group_memberships').select('business_id').eq('group_id', ctx.groupId).in('status', ['INVITED', 'ACTIVE'])
  const existingIds = new Set((existing ?? []).map((r: any) => r.business_id))

  return NextResponse.json((candidates ?? []).filter((c: any) => !existingIds.has(c.id)))
}
