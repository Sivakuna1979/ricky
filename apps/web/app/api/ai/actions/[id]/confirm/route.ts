// @ts-nocheck
// ============================================================================
// The ONLY place a FoodTaxi AI write proposal actually executes (E22–E24).
// Requires a real authenticated POST from the UI's Confirm button — never
// triggered by the model itself, and never inferred from conversation text.
//
// Replay/double-execution protection: the UPDATE ... WHERE status='PENDING'
// is the atomic guard (same compare-and-set pattern as Phase D's
// claimRun()) — a double-click, a retried request, or an attempt to
// confirm an already-confirmed/expired/cancelled action all hit zero
// affected rows and are rejected, not silently re-run.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveAiContext } from '@/lib/ai/context'
import { hasPermission } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/auditLog'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await resolveAiContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No authorised business found for this account.' }, { status: 404 })

  const admin = await createAdminClient()
  const { data: pending } = await admin.from('ai_pending_actions').select('*').eq('id', params.id).maybeSingle()
  if (!pending) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Re-validated independently of whatever the browser/model claimed —
  // wrong user or wrong business can never confirm someone else's action.
  if (pending.user_id !== ctx.userId || pending.business_id !== ctx.businessId) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }
  if (pending.status !== 'PENDING') {
    return NextResponse.json({ error: `This action is ${pending.status.toLowerCase()} and can no longer be confirmed.` }, { status: 409 })
  }
  if (new Date(pending.expires_at) < new Date()) {
    await admin.from('ai_pending_actions').update({ status: 'EXPIRED' }).eq('id', pending.id).eq('status', 'PENDING')
    return NextResponse.json({ error: 'This proposal has expired — ask FoodTaxi AI again to create a fresh one.' }, { status: 410 })
  }

  const requiredPermission = pending.action_type === 'create_purchase_order' ? 'manage_purchase_orders' : null
  if (requiredPermission && !hasPermission(ctx.role, requiredPermission)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // Atomic claim — the actual double-execution guard.
  const { data: claimed } = await admin
    .from('ai_pending_actions').update({ status: 'CONFIRMED', confirmed_at: new Date().toISOString() })
    .eq('id', pending.id).eq('status', 'PENDING')
    .select('id').maybeSingle()
  if (!claimed) return NextResponse.json({ error: 'This action was already handled.' }, { status: 409 })

  try {
    let result: any = null
    if (pending.action_type === 'create_purchase_order') {
      const { supplier_id, items } = pending.params
      const { data: po, error } = await admin.from('purchase_orders').insert({
        business_id: ctx.businessId, supplier_id, status: 'DRAFT', ordered_by: ctx.userId,
        notes: 'Created via FoodTaxi AI — review before ordering.',
      }).select().single()
      if (error) throw error
      await admin.from('purchase_order_items').insert(
        items.map((i: any) => ({ purchase_order_id: po.id, stock_item_id: i.stock_item_id, quantity_ordered: i.quantity, unit_cost: i.unit_cost ?? null }))
      )
      result = { purchase_order_id: po.id }
    } else {
      throw new Error('unknown_action_type')
    }

    await admin.from('ai_pending_actions').update({ status: 'EXECUTED', executed_at: new Date().toISOString(), result }).eq('id', pending.id)
    await logAuditEvent(admin, {
      actorId: ctx.userId, action: 'ai.action_executed', entityType: pending.action_type, entityId: result?.purchase_order_id ?? pending.id,
      newValues: { pending_action_id: pending.id, params: pending.params, result },
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    await admin.from('ai_pending_actions').update({ status: 'FAILED', result: { error: e.message ?? 'execution_failed' } }).eq('id', pending.id)
    return NextResponse.json({ error: 'Could not complete this action — nothing was created.' }, { status: 500 })
  }
}
