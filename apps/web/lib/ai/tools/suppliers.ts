// @ts-nocheck
import { round2 } from '@/lib/ai/queries/orders'

export const supplierTools = [
  {
    name: 'get_open_purchase_orders',
    description: "Purchase orders that are still ORDERED or PARTIALLY_RECEIVED (i.e. outstanding, awaiting delivery). Does not include DRAFT (not yet sent) or fully RECEIVED orders.",
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      const { data } = await admin.from('purchase_orders').select('id, status, expected_date, supplier_records(supplier_name), purchase_order_items(quantity_ordered, quantity_received)').eq('business_id', ctx.businessId).in('status', ['ORDERED', 'PARTIALLY_RECEIVED'])
      return {
        outstanding_purchase_orders: (data ?? []).map((po: any) => ({
          supplier: po.supplier_records?.supplier_name, status: po.status, expected_date: po.expected_date,
          line_items: po.purchase_order_items?.length ?? 0,
        })),
      }
    },
  },
  {
    name: 'get_supplier_summary',
    description: "Spend and recent purchase orders for a supplier (or all suppliers if none named). Spend is only calculated from purchase order line items that have a unit cost recorded and have been received — if cost data is incomplete for some orders, this is stated explicitly rather than silently under-reporting.",
    input_schema: { type: 'object', properties: { supplier_name: { type: 'string', description: 'Optional — omit to summarise all suppliers.' } } },
    async handler(admin: any, ctx: any, args: any) {
      let supplierQuery = admin.from('supplier_records').select('id, supplier_name').eq('business_id', ctx.businessId).eq('is_active', true)
      if (args.supplier_name) supplierQuery = supplierQuery.ilike('supplier_name', `%${args.supplier_name}%`)
      const { data: suppliers } = await supplierQuery
      if (!suppliers?.length) return { found: false, message: args.supplier_name ? `No supplier matching "${args.supplier_name}" was found.` : 'No suppliers on file.' }

      const results = []
      for (const s of suppliers) {
        const { data: pos } = await admin.from('purchase_orders').select('id, status, created_at, purchase_order_items(quantity_received, unit_cost)').eq('supplier_id', s.id)
        let spend = 0
        let hasIncompleteCost = false
        let receivedOrderCount = 0
        for (const po of pos ?? []) {
          if (po.status !== 'RECEIVED' && po.status !== 'PARTIALLY_RECEIVED') continue
          receivedOrderCount++
          for (const item of po.purchase_order_items ?? []) {
            if (item.unit_cost == null) { hasIncompleteCost = true; continue }
            spend += (item.unit_cost ?? 0) * (item.quantity_received ?? 0)
          }
        }
        results.push({
          supplier: s.supplier_name, total_orders: pos?.length ?? 0, received_or_partial_orders: receivedOrderCount,
          known_spend: round2(spend), cost_data_complete: !hasIncompleteCost,
        })
      }
      return { suppliers: results }
    },
  },
]
