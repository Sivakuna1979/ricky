// @ts-nocheck
// M31-M35 — group documents. `url` is an external link (no file-upload
// storage exists anywhere in apps/web today — see the migration's own
// comment) — consistent with how businesses.logo_url etc already work.
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
  let query = admin.from('group_documents').select('*').eq('group_id', ctx.groupId)
  if (ctx.role === 'REGIONAL_MANAGER' && ctx.regionId) query = query.or(`visibility.eq.ALL,region_id.eq.${ctx.regionId}`)
  const { data } = await query.order('created_at', { ascending: false })
  return NextResponse.json(data ?? [])
}

// Body: { title, category, url, visibility?, region_id?, business_ids? }
export async function POST(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'manage_group_documents')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  if (!body.title?.trim() || !body.url?.trim()) return NextResponse.json({ error: 'title and url are required' }, { status: 400 })
  const category = ['MANUAL', 'SOP', 'TRAINING', 'SUPPLIER_LIST', 'MENU_STANDARD', 'OTHER'].includes(body.category) ? body.category : 'OTHER'
  const visibility = ['ALL', 'REGION', 'SELECTED'].includes(body.visibility) ? body.visibility : 'ALL'

  const admin = await createAdminClient()
  const { data: doc, error } = await admin.from('group_documents').insert({
    group_id: ctx.groupId, title: body.title.trim(), category, url: body.url.trim(),
    visibility, region_id: visibility === 'REGION' ? (body.region_id ?? null) : null, created_by: ctx.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (visibility === 'SELECTED' && Array.isArray(body.business_ids) && body.business_ids.length) {
    await admin.from('group_document_targets').insert(body.business_ids.map((business_id: string) => ({ document_id: doc.id, business_id })))
  }

  return NextResponse.json(doc, { status: 201 })
}
