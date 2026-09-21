// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveGroupContext } from '@/lib/groups/context'
import { getStaffContext } from '@/lib/staffContext'

// Body: { business_id, stock_item_name, quantity, notes? } — any member
// business's own owner/staff (manage_purchase_orders) may add THEIR OWN
// demand line; group staff with manage_group_catalogue may add on behalf
// of any member business (e.g. compiling a combined order).
export async function POST(req: NextRequest, { params }: { params: { groupId: string; id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!body.business_id || !body.stock_item_name || !body.quantity) return NextResponse.json({ error: 'business_id, stock_item_name and quantity are required' }, { status: 400 })

  const staffCtx = await getStaffContext(supabase, user.id, body.business_id)
  const canAsBusiness = staffCtx && staffCtx.businessId === body.business_id
  let authorised = canAsBusiness

  if (!authorised) {
    const groupCtx = await resolveGroupContext(supabase, user.id, params.groupId)
    authorised = Boolean(groupCtx && groupCtx.memberBusinessIds.includes(body.business_id) && ['GROUP_OWNER', 'GROUP_ADMIN', 'GROUP_OPERATIONS'].includes(groupCtx.role))
  }
  if (!authorised) return NextResponse.json({ error: 'Not authorized for that business' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: proposal } = await admin.from('group_purchase_proposals').select('id, group_id').eq('id', params.id).eq('group_id', params.groupId).maybeSingle()
  if (!proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })

  const { data, error } = await admin.from('group_purchase_proposal_items').insert({
    proposal_id: params.id, business_id: body.business_id, stock_item_name: body.stock_item_name.trim(), quantity: Number(body.quantity), notes: body.notes ?? null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
