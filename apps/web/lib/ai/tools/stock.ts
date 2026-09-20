// @ts-nocheck
import { resolveDateRange, DATE_RANGE_OPTIONS } from '@/lib/ai/dateRange'
import { round2 } from '@/lib/ai/queries/orders'

const dateRangeSchema = { type: 'string', enum: DATE_RANGE_OPTIONS, description: 'Which period to report on.' }

async function stockTotals(admin: any, businessId: string) {
  const { data: items } = await admin.from('stock_items').select('id, name, unit, minimum_quantity, reorder_quantity').eq('business_id', businessId).eq('active', true)
  const ids = (items ?? []).map((i: any) => i.id)
  const { data: levels } = ids.length ? await admin.from('stock_levels').select('stock_item_id, quantity').in('stock_item_id', ids) : { data: [] }
  const totals: Record<string, number> = {}
  for (const l of levels ?? []) totals[l.stock_item_id] = (totals[l.stock_item_id] ?? 0) + (l.quantity ?? 0)
  return { items: items ?? [], totals }
}

export const stockTools = [
  {
    name: 'get_low_stock',
    description: 'Stock items at or below their configured minimum quantity (but not zero).',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      const { items, totals } = await stockTotals(admin, ctx.businessId)
      const low = items.filter((i: any) => { const q = totals[i.id] ?? 0; return q > 0 && q <= i.minimum_quantity })
        .map((i: any) => ({ name: i.name, current_quantity: totals[i.id] ?? 0, unit: i.unit, minimum_quantity: i.minimum_quantity, reorder_quantity: i.reorder_quantity ?? null }))
      return { low_stock_items: low }
    },
  },
  {
    name: 'get_out_of_stock',
    description: 'Stock items at zero quantity.',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      const { items, totals } = await stockTotals(admin, ctx.businessId)
      const out = items.filter((i: any) => (totals[i.id] ?? 0) <= 0).map((i: any) => ({ name: i.name, unit: i.unit }))
      return { out_of_stock_items: out }
    },
  },
  {
    name: 'get_stock_item',
    description: "Look up the current quantity and details of a specific stock item by name (e.g. 'cod', 'frying oil'). If the item isn't found, say so — don't guess a quantity.",
    input_schema: { type: 'object', properties: { item_name: { type: 'string' } }, required: ['item_name'] },
    async handler(admin: any, ctx: any, args: any) {
      const { data: matches } = await admin.from('stock_items').select('id, name, unit, minimum_quantity, reorder_quantity').eq('business_id', ctx.businessId).eq('active', true).ilike('name', `%${args.item_name}%`)
      if (!matches?.length) return { found: false, message: `No stock item matching "${args.item_name}" was found.` }
      const { data: levels } = await admin.from('stock_levels').select('stock_item_id, quantity, stock_locations(name)').in('stock_item_id', matches.map((m: any) => m.id))
      return {
        found: true,
        items: matches.map((m: any) => {
          const itemLevels = (levels ?? []).filter((l: any) => l.stock_item_id === m.id)
          return {
            name: m.name, unit: m.unit, minimum_quantity: m.minimum_quantity, reorder_quantity: m.reorder_quantity ?? null,
            current_quantity: round2(itemLevels.reduce((s: number, l: any) => s + (l.quantity ?? 0), 0)),
            by_location: itemLevels.map((l: any) => ({ location: l.stock_locations?.name, quantity: l.quantity })),
          }
        }),
      }
    },
  },
  {
    name: 'get_wastage_summary',
    description: 'Total wastage cost and items wasted for a period, optionally for one van/location.',
    input_schema: { type: 'object', properties: { date_range: dateRangeSchema } , required: ['date_range']},
    async handler(admin: any, ctx: any, args: any) {
      const { label, start, end } = resolveDateRange(args.date_range, ctx.timezone)
      const { data } = await admin.from('wastage_records').select('quantity, cost, reason, stock_items(name, unit)').eq('business_id', ctx.businessId).gte('created_at', start).lt('created_at', end)
      const totalCost = round2((data ?? []).reduce((s: number, r: any) => s + (r.cost ?? 0), 0))
      return {
        period: label, total_cost: totalCost, record_count: (data ?? []).length,
        items: (data ?? []).map((r: any) => ({ item: r.stock_items?.name, quantity: r.quantity, unit: r.stock_items?.unit, reason: r.reason, cost: r.cost })),
      }
    },
  },
]
