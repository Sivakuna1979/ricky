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

  const PERMISSION_BY_ACTION: Record<string, string> = {
    create_purchase_order: 'manage_purchase_orders',
    create_stock_transfer: 'manage_stock',
    create_expense: 'create_expense',
    create_campaign_draft: 'manage_campaigns',
    // L18/L57 — a real provider refund is a higher-stakes money-movement
    // action than a manual bookkeeping refund entry (approve_expense),
    // so it requires the dedicated payment-integrations permission, not
    // reused from Finance.
    confirm_provider_refund: 'manage_payment_integrations',
  }
  const requiredPermission = PERMISSION_BY_ACTION[pending.action_type]
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
    } else if (pending.action_type === 'create_stock_transfer') {
      // G26 — reuses Phase C's apply_stock_movement exactly as an owner
      // manually transferring stock would (app/api/stock/transfer),
      // recorded as a linked TRANSFER_OUT/TRANSFER_IN pair, never a
      // silent quantity overwrite.
      const { from_location_id, to_location_id, items } = pending.params
      const referenceId = pending.id
      for (const item of items) {
        await admin.rpc('apply_stock_movement', {
          p_business_id: ctx.businessId, p_stock_item_id: item.stock_item_id, p_location_id: from_location_id,
          p_movement_type: 'TRANSFER_OUT', p_delta: -item.quantity, p_user_id: ctx.userId,
          p_reference_type: 'transfer', p_reference_id: referenceId,
        })
        await admin.rpc('apply_stock_movement', {
          p_business_id: ctx.businessId, p_stock_item_id: item.stock_item_id, p_location_id: to_location_id,
          p_movement_type: 'TRANSFER_IN', p_delta: item.quantity, p_user_id: ctx.userId,
          p_reference_type: 'transfer', p_reference_id: referenceId,
        })
      }
      result = { transferred_items: items.length, reference_id: referenceId }
    } else if (pending.action_type === 'create_expense') {
      // H60/H65 — the AI never inserts an expense itself; this confirm
      // step (a real authenticated click, never the model) is the only
      // place the row is actually created, identical in shape to a
      // manual expense entry (POST /api/finance/expenses).
      const { description, category, net_amount, vat_amount, gross_amount, expense_date, supplier_id, van_id } = pending.params
      const { data: expense, error } = await admin.from('expenses').insert({
        business_id: ctx.businessId, expense_date, supplier_id, van_id,
        description, category, net_amount, vat_amount, gross_amount,
        payment_method: 'other', source: 'manual', status: 'CONFIRMED', created_by: ctx.userId,
      }).select().single()
      if (error) throw error
      result = { expense_id: expense.id }
    } else if (pending.action_type === 'create_campaign_draft') {
      // I57/I59 — the AI never creates a real campaign row itself; this
      // confirm step only creates a DRAFT, which still requires its own
      // separate Confirm & Send action under Customers → Campaigns
      // before anything is actually sent (two distinct confirmations,
      // never one click to bulk-send).
      const { name, channel, segment_definition, subject, message, campaign_type, estimated_recipients } = pending.params
      const { data: campaign, error } = await admin.from('campaigns').insert({
        business_id: ctx.businessId, name, channel, segment_definition, subject, message,
        status: 'DRAFT', campaign_type, estimated_recipients, created_by: ctx.userId,
      }).select().single()
      if (error) throw error
      result = { campaign_id: campaign.id }
    } else if (pending.action_type === 'confirm_provider_refund') {
      // L18 — the ONLY place a provider_refunds row can move off PENDING.
      // Server revalidates everything independently of what was proposed
      // (E24) — the original provider_transaction is re-read fresh, never
      // trusted from `pending.params`. If no real provider connection is
      // CONNECTED (true for every business today, since no provider is
      // yet approved), this fails loudly rather than pretending a refund
      // happened — nothing here ever fakes success.
      const { provider_refund_id } = pending.params
      const { data: refundRow } = await admin.from('provider_refunds').select('*, provider_transactions(*)').eq('id', provider_refund_id).maybeSingle()
      if (!refundRow || refundRow.business_id !== ctx.businessId) throw new Error('refund_not_found')
      if (refundRow.status !== 'PENDING') throw new Error('refund_already_handled')

      const { data: connection } = await admin.from('payment_provider_connections').select('status').eq('id', refundRow.provider_transactions.connection_id).maybeSingle()
      if (!connection || connection.status !== 'CONNECTED') {
        await admin.from('provider_refunds').update({ status: 'FAILED', confirmed_by: ctx.userId, updated_at: new Date().toISOString() }).eq('id', refundRow.id)
        throw new Error('no_active_payment_provider — no live payment provider is connected for this business, so nothing has been refunded.')
      }
      // Real provider refund API call would happen here once a provider
      // is approved and connected (L-B) — intentionally not implemented
      // against a specific provider yet (see the Phase L decision report).
      throw new Error('provider_refund_not_yet_implemented')
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
