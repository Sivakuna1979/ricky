// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveGroupContext } from '@/lib/groups/context'
import { hasGroupPermission } from '@/lib/groups/permissions'

// Body: { category, name, description?, allergens?, recommended_price?, price_policy?, image_url?, sort_order? }
export async function POST(req: NextRequest, { params }: { params: { groupId: string; id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'manage_group_templates')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  if (!body.category || !body.name) return NextResponse.json({ error: 'category and name are required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: template } = await admin.from('group_menu_templates').select('id').eq('id', params.id).eq('group_id', ctx.groupId).maybeSingle()
  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

  const pricePolicy = ['REQUIRED', 'RECOMMENDED', 'BUSINESS_CONTROLLED'].includes(body.price_policy) ? body.price_policy : 'BUSINESS_CONTROLLED'
  const { data: item, error } = await admin.from('group_menu_template_items').insert({
    template_id: params.id, category: body.category, name: body.name, description: body.description ?? null,
    allergens: body.allergens ?? null, recommended_price: body.recommended_price ?? null, price_policy: pricePolicy,
    image_url: body.image_url ?? null, sort_order: body.sort_order ?? 0,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(item, { status: 201 })
}
