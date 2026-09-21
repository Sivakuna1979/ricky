// @ts-nocheck
// M30 — group purchasing proposals: a draft shared list only. Creating a
// proposal, or adding lines to it, NEVER creates a real purchase_orders
// row or any liability — a business converts its own line into its own
// real PO explicitly (see /purchases/[id]/items's convert action).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveGroupContext } from '@/lib/groups/context'
import { hasGroupPermission } from '@/lib/groups/permissions'

export async function GET(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data } = await admin.from('group_purchase_proposals').select('*, group_purchase_proposal_items(*)').eq('group_id', ctx.groupId).order('created_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

// Body: { title, notes? }
export async function POST(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'manage_group_catalogue')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  if (!body.title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data, error } = await admin.from('group_purchase_proposals').insert({ group_id: ctx.groupId, title: body.title.trim(), notes: body.notes ?? null, created_by: ctx.userId }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
