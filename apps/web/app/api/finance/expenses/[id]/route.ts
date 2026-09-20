// @ts-nocheck
// H8/H56 — expenses are corrected, never silently rewritten: an edit is
// audited (old vs new), and "delete" is really VOID (kept, flagged,
// excluded from summaries — expenses summary already filters status =
// 'CONFIRMED'). Void requires approve_expense (a step up from the
// create_expense permission that made it).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { round2 } from '@/lib/finance/money'
import { logAuditEvent } from '@/lib/auditLog'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: existing } = await admin.from('expenses').select('*').eq('id', params.id).maybeSingle()
  if (!existing || existing.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  if (body.status === 'VOID') {
    if (!hasPermission(ctx.role, 'approve_expense')) return NextResponse.json({ error: 'Not authorized to void an expense' }, { status: 403 })
    const { data: voided } = await admin.from('expenses').update({ status: 'VOID', voided_at: new Date().toISOString(), voided_by: ctx.userId }).eq('id', params.id).select().single()
    await logAuditEvent(admin, { actorId: ctx.userId, action: 'finance.expense_voided', entityType: 'expenses', entityId: params.id, oldValues: existing, newValues: voided })
    return NextResponse.json(voided)
  }

  if (!hasPermission(ctx.role, 'create_expense')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  const updates: any = {}
  for (const field of ['description', 'category', 'expense_date', 'supplier_id', 'van_id', 'payment_method', 'reference']) {
    if (body[field] !== undefined) updates[field] = body[field]
  }
  if (body.net_amount != null || body.vat_amount != null) {
    const net = round2(Number(body.net_amount ?? existing.net_amount))
    const vat = round2(Number(body.vat_amount ?? existing.vat_amount))
    updates.net_amount = net; updates.vat_amount = vat; updates.gross_amount = round2(net + vat)
  }
  updates.updated_at = new Date().toISOString()

  const { data: updated, error } = await admin.from('expenses').update(updates).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await logAuditEvent(admin, { actorId: ctx.userId, action: 'finance.expense_edited', entityType: 'expenses', entityId: params.id, oldValues: existing, newValues: updated })
  return NextResponse.json(updated)
}
