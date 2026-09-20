// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const { data: po } = await supabase.from('purchase_orders').select('*, supplier_records(supplier_name, phone, email)').eq('id', params.id).maybeSingle()
  if (!po || po.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: items } = await supabase.from('purchase_order_items').select('*, stock_items(name, unit)').eq('purchase_order_id', params.id)
  return NextResponse.json({ ...po, items })
}

// Status/notes updates only (not item quantities — that happens via
// /receive). Status changes are audit-logged (C29).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_purchase_orders')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: existing } = await admin.from('purchase_orders').select('*').eq('id', params.id).maybeSingle()
  if (!existing || existing.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  if (body.status) {
    const validTransitions: Record<string, string[]> = {
      DRAFT: ['ORDERED', 'CANCELLED'],
      ORDERED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
      PARTIALLY_RECEIVED: ['RECEIVED', 'CANCELLED'],
    }
    if (existing.status !== body.status && !(validTransitions[existing.status] ?? []).includes(body.status)) {
      return NextResponse.json({ error: `Cannot move a ${existing.status} order to ${body.status}` }, { status: 400 })
    }
    update.status = body.status
  }
  if ('notes' in body) update.notes = body.notes
  if ('expected_date' in body) update.expected_date = body.expected_date

  const { data, error } = await admin.from('purchase_orders').update(update).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.status && body.status !== existing.status) {
    await logAuditEvent(admin, {
      actorId: ctx.userId, action: 'purchase_order.status_change', entityType: 'purchase_order', entityId: params.id,
      oldValues: { status: existing.status }, newValues: { status: body.status },
    })
  }

  return NextResponse.json(data)
}
