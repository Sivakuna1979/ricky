// @ts-nocheck
import { resolveDateRange, DATE_RANGE_OPTIONS } from '@/lib/ai/dateRange'
import { allowedVanIds, assertVanAllowed } from '@/lib/ai/context'
import { fetchRevenueOrders, summarizeOrders, round2 } from '@/lib/ai/queries/orders'

const dateRangeSchema = { type: 'string', enum: DATE_RANGE_OPTIONS, description: 'Which period to report on.' }
const vanIdSchema = { type: 'string', description: "A specific van's id, if the question is about one van. Omit for all vans the caller can see." }

export const salesTools = [
  {
    name: 'get_business_overview',
    description: "Today's/this week's/this month's revenue, orders and average order value, plus counts of open operational issues (low stock, hygiene, vehicles, events). Use for broad 'how are we doing' questions.",
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      const vanIds = await allowedVanIds(admin, ctx)
      const now = new Date()
      const todayStart = new Date(now); todayStart.setUTCHours(0, 0, 0, 0)
      const weekStart = new Date(now.getTime() - 7 * 86400000)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const [today, week, month] = await Promise.all([
        fetchRevenueOrders(admin, vanIds, todayStart.toISOString(), new Date(todayStart.getTime() + 86400000).toISOString()),
        fetchRevenueOrders(admin, vanIds, weekStart.toISOString(), now.toISOString()),
        fetchRevenueOrders(admin, vanIds, monthStart.toISOString(), now.toISOString()),
      ])

      const { data: items } = await admin.from('stock_items').select('id, minimum_quantity').eq('business_id', ctx.businessId).eq('active', true)
      const { data: levels } = await admin.from('stock_levels').select('stock_item_id, quantity')
      const totals: Record<string, number> = {}
      for (const l of levels ?? []) totals[l.stock_item_id] = (totals[l.stock_item_id] ?? 0) + (l.quantity ?? 0)
      const lowStock = (items ?? []).filter((i: any) => { const q = totals[i.id] ?? 0; return q > 0 && q <= i.minimum_quantity }).length
      const outOfStock = (items ?? []).filter((i: any) => (totals[i.id] ?? 0) <= 0).length

      const { count: eventCount } = await admin.from('event_requests').select('id', { count: 'exact', head: true }).eq('admin_status', 'new')

      return {
        business: ctx.businessName,
        today: summarizeOrders(today), this_week: summarizeOrders(week), this_month: summarizeOrders(month),
        low_stock_items: lowStock, out_of_stock_items: outOfStock, event_enquiries_awaiting_response: eventCount ?? 0,
      }
    },
  },
  {
    name: 'get_sales_summary',
    description: 'Revenue, order count and average order value for a specific period, optionally for one van.',
    input_schema: { type: 'object', properties: { date_range: dateRangeSchema, van_id: vanIdSchema }, required: ['date_range'] },
    async handler(admin: any, ctx: any, args: any) {
      assertVanAllowed(ctx, args.van_id)
      const vanIds = args.van_id ? [args.van_id] : await allowedVanIds(admin, ctx)
      const { label, start, end } = resolveDateRange(args.date_range, ctx.timezone)
      const orders = await fetchRevenueOrders(admin, vanIds, start, end)
      return { period: label, van_id: args.van_id ?? 'all', ...summarizeOrders(orders) }
    },
  },
  {
    name: 'get_top_products',
    description: 'Best-selling menu items by quantity for a period, optionally for one van.',
    input_schema: { type: 'object', properties: { date_range: dateRangeSchema, van_id: vanIdSchema, limit: { type: 'number', description: 'How many to return, default 5' } }, required: ['date_range'] },
    async handler(admin: any, ctx: any, args: any) {
      assertVanAllowed(ctx, args.van_id)
      const vanIds = args.van_id ? [args.van_id] : await allowedVanIds(admin, ctx)
      const { label, start, end } = resolveDateRange(args.date_range, ctx.timezone)
      const orders = await fetchRevenueOrders(admin, vanIds, start, end)
      if (!orders.length) return { period: label, top_products: [] }
      const { data: items } = await admin.from('order_items').select('name, quantity, order_id').in('order_id', orders.map((o: any) => o.id).slice(0, 500))
      const tally: Record<string, number> = {}
      for (const it of items ?? []) tally[it.name] = (tally[it.name] ?? 0) + (it.quantity ?? 1)
      const top = Object.entries(tally).sort((a: any, b: any) => b[1] - a[1]).slice(0, args.limit ?? 5).map(([name, quantity]) => ({ name, quantity }))
      return { period: label, top_products: top }
    },
  },
  {
    name: 'get_payment_breakdown',
    description: 'Revenue split by payment method (cash at van, card at van, card online) for a period.',
    input_schema: { type: 'object', properties: { date_range: dateRangeSchema, van_id: vanIdSchema }, required: ['date_range'] },
    async handler(admin: any, ctx: any, args: any) {
      assertVanAllowed(ctx, args.van_id)
      const vanIds = args.van_id ? [args.van_id] : await allowedVanIds(admin, ctx)
      const { label, start, end } = resolveDateRange(args.date_range, ctx.timezone)
      const orders = await fetchRevenueOrders(admin, vanIds, start, end)
      const tally: Record<string, { revenue: number; count: number }> = {}
      for (const o of orders) {
        const pm = o.payment_method ?? 'unknown'
        tally[pm] = tally[pm] ?? { revenue: 0, count: 0 }
        tally[pm].revenue += o.total ?? 0; tally[pm].count += 1
      }
      return { period: label, breakdown: Object.entries(tally).map(([method, v]: any) => ({ method, revenue: round2(v.revenue), orders: v.count })) }
    },
  },
  {
    name: 'get_order_channel_breakdown',
    description: 'Revenue split by order channel (online, POS/till, WhatsApp, guest) for a period.',
    input_schema: { type: 'object', properties: { date_range: dateRangeSchema, van_id: vanIdSchema }, required: ['date_range'] },
    async handler(admin: any, ctx: any, args: any) {
      assertVanAllowed(ctx, args.van_id)
      const vanIds = args.van_id ? [args.van_id] : await allowedVanIds(admin, ctx)
      const { label, start, end } = resolveDateRange(args.date_range, ctx.timezone)
      const orders = await fetchRevenueOrders(admin, vanIds, start, end)
      const tally: Record<string, { revenue: number; count: number }> = {}
      for (const o of orders) {
        const src = o.source ?? 'unknown'
        tally[src] = tally[src] ?? { revenue: 0, count: 0 }
        tally[src].revenue += o.total ?? 0; tally[src].count += 1
      }
      return { period: label, breakdown: Object.entries(tally).map(([source, v]: any) => ({ source, revenue: round2(v.revenue), orders: v.count })) }
    },
  },
  {
    name: 'get_van_comparison',
    description: "Revenue and order count per van for a period — use for 'which van did best' or 'compare my vans' questions.",
    input_schema: { type: 'object', properties: { date_range: dateRangeSchema }, required: ['date_range'] },
    async handler(admin: any, ctx: any, args: any) {
      const vanIds = await allowedVanIds(admin, ctx)
      const { data: vans } = await admin.from('vans').select('id, name').in('id', vanIds)
      const { label, start, end } = resolveDateRange(args.date_range, ctx.timezone)
      const orders = await fetchRevenueOrders(admin, vanIds, start, end)
      const tally: Record<string, { revenue: number; count: number }> = {}
      for (const o of orders) {
        tally[o.van_id] = tally[o.van_id] ?? { revenue: 0, count: 0 }
        tally[o.van_id].revenue += o.total ?? 0; tally[o.van_id].count += 1
      }
      const result = (vans ?? []).map((v: any) => ({ van: v.name, revenue: round2(tally[v.id]?.revenue ?? 0), orders: tally[v.id]?.count ?? 0 }))
        .sort((a: any, b: any) => b.revenue - a.revenue)
      return { period: label, vans: result }
    },
  },
]
