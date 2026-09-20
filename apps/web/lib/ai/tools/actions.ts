// @ts-nocheck
// The ONE write-capable tool in Phase E (E20–E24). It never creates the
// purchase order itself — it only ever creates a PENDING row in
// ai_pending_actions and returns its id. The actual creation happens in
// app/api/ai/actions/[id]/confirm/route.ts, which requires a separate,
// explicit, authenticated POST from the UI's [CONFIRM] button — never
// something the model can trigger on its own, and never inferred from the
// model merely saying "the user confirmed" (E24).
import { round2 } from '@/lib/ai/queries/orders'
import { hasPermission } from '@/lib/permissions'

const PENDING_ACTION_TTL_MINUTES = 30

export const actionTools = [
  {
    name: 'propose_purchase_order',
    description: "Prepare a DRAFT purchase order for the owner to review and confirm. This does NOT create or send anything by itself — it only prepares a proposal the user must explicitly confirm in the UI. Use when the user asks to order/reorder stock.",
    input_schema: {
      type: 'object',
      properties: {
        supplier_name: { type: 'string', description: "The supplier to order from — must match an existing supplier on file." },
        items: {
          type: 'array',
          items: { type: 'object', properties: { stock_item_name: { type: 'string' }, quantity: { type: 'number' } }, required: ['stock_item_name', 'quantity'] },
        },
      },
      required: ['supplier_name', 'items'],
    },
    async handler(admin: any, ctx: any, args: any, conversationId: string) {
      if (!hasPermission(ctx.role, 'manage_purchase_orders')) {
        return { proposed: false, message: "This account doesn't have permission to create purchase orders." }
      }

      const { data: supplier } = await admin.from('supplier_records').select('id, supplier_name').eq('business_id', ctx.businessId).eq('is_active', true).ilike('supplier_name', `%${args.supplier_name}%`).maybeSingle()
      if (!supplier) return { proposed: false, message: `No active supplier matching "${args.supplier_name}" was found.` }

      const resolvedItems = []
      for (const item of args.items ?? []) {
        const { data: stockItem } = await admin.from('stock_items').select('id, name, unit, cost_price').eq('business_id', ctx.businessId).eq('active', true).ilike('name', `%${item.stock_item_name}%`).maybeSingle()
        if (!stockItem) return { proposed: false, message: `No stock item matching "${item.stock_item_name}" was found — nothing has been proposed.` }
        resolvedItems.push({ stock_item_id: stockItem.id, name: stockItem.name, unit: stockItem.unit, quantity: item.quantity, unit_cost: stockItem.cost_price ?? null })
      }

      const estimatedTotal = resolvedItems.reduce((s, i) => s + (i.unit_cost ? i.unit_cost * i.quantity : 0), 0)
      const hasIncompleteCost = resolvedItems.some(i => i.unit_cost == null)

      const { data: pending, error } = await admin.from('ai_pending_actions').insert({
        business_id: ctx.businessId, user_id: ctx.userId, conversation_id: conversationId,
        action_type: 'create_purchase_order',
        params: { supplier_id: supplier.id, supplier_name: supplier.supplier_name, items: resolvedItems },
        expires_at: new Date(Date.now() + PENDING_ACTION_TTL_MINUTES * 60000).toISOString(),
      }).select('id').single()
      if (error) throw new Error('pending_action_create_failed')

      return {
        proposed: true,
        pending_action_id: pending.id,
        supplier: supplier.supplier_name,
        items: resolvedItems.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
        estimated_total: hasIncompleteCost ? null : round2(estimatedTotal),
        cost_note: hasIncompleteCost ? 'Cost is unknown for one or more items, so no total estimate is shown.' : null,
        expires_in_minutes: PENDING_ACTION_TTL_MINUTES,
        note: 'This is a DRAFT only. Nothing has been created or sent. The user must press Confirm in the app to actually create the purchase order.',
      }
    },
  },
]
