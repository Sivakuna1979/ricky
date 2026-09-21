// @ts-nocheck
// M29 — group preferred-supplier DIRECTORY only: name/category/notes.
// Account numbers, pricing and contact details stay in each business's
// own private `supplier_records` table, completely untouched by this file.
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
  const { data } = await admin.from('group_preferred_suppliers').select('*').eq('group_id', ctx.groupId).order('name')
  return NextResponse.json(data ?? [])
}

// Body: { name, category?, notes? }
export async function POST(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'manage_group_catalogue')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  if (!body.name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data, error } = await admin.from('group_preferred_suppliers').insert({ group_id: ctx.groupId, name: body.name.trim(), category: body.category ?? null, notes: body.notes ?? null, created_by: ctx.userId }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
