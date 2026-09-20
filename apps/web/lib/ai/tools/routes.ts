// @ts-nocheck
// Route Intelligence tools for FoodTaxi AI (G39, G40) — the exact same
// lib/routes/analytics.ts and lib/routes/demand.ts functions the
// dashboard uses, so the AI's answers and the dashboard's numbers can
// never disagree. Read-only except propose_stock_transfer, which — like
// Phase E's propose_purchase_order — only ever creates a PENDING
// ai_pending_actions row for the user to confirm themselves (G63/G64).
import * as routeAnalytics from '@/lib/routes/analytics'
import { getLoadingPlan } from '@/lib/routes/demand'
import { resolveInclusiveDateRange, DATE_RANGE_OPTIONS } from '@/lib/ai/dateRange'
import { allowedVanIds, assertVanAllowed } from '@/lib/ai/context'
import { hasPermission } from '@/lib/permissions'

const dateRangeSchema = { type: 'string', enum: DATE_RANGE_OPTIONS, description: 'Which period to report on.' }
const vanIdSchema = { type: 'string', description: "A specific van's id. Omit for all vans the caller can see." }

async function resolveStopIdByName(admin: any, businessId: string, vanIds: string[], stopName: string) {
  const { data } = await admin.from('van_schedule').select('id, location_name, van_id').in('van_id', vanIds).ilike('location_name', `%${stopName}%`)
  return data ?? []
}

export const routeTools = [
  {
    name: 'get_route_performance',
    description: "Revenue/orders/average order value for a period, broken down by van — 'which van did best', 'how are all vans doing'.",
    input_schema: { type: 'object', properties: { date_range: dateRangeSchema, van_id: vanIdSchema }, required: ['date_range'] },
    async handler(admin: any, ctx: any, args: any) {
      if (args.van_id) assertVanAllowed(ctx, args.van_id)
      const { label, startDate, endDate } = resolveInclusiveDateRange(args.date_range, ctx.timezone)
      const data = await routeAnalytics.getRoutePerformance(admin, ctx.businessId, { startDate, endDate, vanId: args.van_id })
      return { period: label, ...data }
    },
  },
  {
    name: 'get_stop_performance',
    description: "Revenue/orders/average order value/top products/revenue-per-trading-hour for a named stop (e.g. 'Slinfold') over a period. Only available for orders placed since stop-level tracking began.",
    input_schema: { type: 'object', properties: { stop_name: { type: 'string' }, date_range: dateRangeSchema }, required: ['stop_name', 'date_range'] },
    async handler(admin: any, ctx: any, args: any) {
      const vanIds = await allowedVanIds(admin, ctx)
      const matches = await resolveStopIdByName(admin, ctx.businessId, vanIds, args.stop_name)
      if (!matches.length) return { found: false, message: `No stop matching "${args.stop_name}" was found.` }
      const { label, startDate, endDate } = resolveInclusiveDateRange(args.date_range, ctx.timezone)
      const results = []
      for (const m of matches) results.push(await routeAnalytics.getStopPerformance(admin, ctx.businessId, m.id, { startDate, endDate }))
      return { period: label, matches: results }
    },
  },
  {
    name: 'compare_stops',
    description: 'Compare several named stops side by side over a period — revenue, orders, average order value, revenue/hour. Never assigns a good/bad label; just the numbers.',
    input_schema: { type: 'object', properties: { stop_names: { type: 'array', items: { type: 'string' } }, date_range: dateRangeSchema }, required: ['stop_names', 'date_range'] },
    async handler(admin: any, ctx: any, args: any) {
      const vanIds = await allowedVanIds(admin, ctx)
      const ids: string[] = []
      for (const name of args.stop_names) {
        const matches = await resolveStopIdByName(admin, ctx.businessId, vanIds, name)
        ids.push(...matches.map((m: any) => m.id))
      }
      if (!ids.length) return { found: false, message: 'None of those stops were found.' }
      const { label, startDate, endDate } = resolveInclusiveDateRange(args.date_range, ctx.timezone)
      const data = await routeAnalytics.compareStops(admin, ctx.businessId, ids, { startDate, endDate })
      return { period: label, ...data }
    },
  },
  {
    name: 'get_day_performance',
    description: "Average revenue/orders/average order value by day of week for a van, with sample size (number of trading days) shown for each day — 'what do Fridays usually look like'.",
    input_schema: { type: 'object', properties: { van_id: vanIdSchema, weeks_back: { type: 'number', description: 'How many weeks of history to consider, default 12' } } },
    async handler(admin: any, ctx: any, args: any) {
      const vanIds = args.van_id ? [args.van_id] : await allowedVanIds(admin, ctx)
      if (args.van_id) assertVanAllowed(ctx, args.van_id)
      if (!vanIds.length) return { days: [] }
      return await routeAnalytics.getDayOfWeekPerformance(admin, ctx.businessId, vanIds[0], args.weeks_back ?? 12)
    },
  },
  {
    name: 'get_product_sales_by_stop',
    description: "What sells at a named stop, as a percentage breakdown of items sold there, over a period.",
    input_schema: { type: 'object', properties: { stop_name: { type: 'string' }, date_range: dateRangeSchema }, required: ['stop_name', 'date_range'] },
    async handler(admin: any, ctx: any, args: any) {
      const vanIds = await allowedVanIds(admin, ctx)
      const matches = await resolveStopIdByName(admin, ctx.businessId, vanIds, args.stop_name)
      if (!matches.length) return { found: false, message: `No stop matching "${args.stop_name}" was found.` }
      const { label, startDate, endDate } = resolveInclusiveDateRange(args.date_range, ctx.timezone)
      const results = []
      for (const m of matches) results.push(await routeAnalytics.getProductByStop(admin, ctx.businessId, m.id, { startDate, endDate }))
      return { period: label, matches: results }
    },
  },
  {
    name: 'get_route_anomalies',
    description: "Whether a given date's trading was unusual for a van, compared to the average of recent same-weekday trading days. Purely factual (a measured percentage difference) — never guesses a cause.",
    input_schema: { type: 'object', properties: { van_id: vanIdSchema, date: { type: 'string', description: 'YYYY-MM-DD, defaults to yesterday' } } },
    async handler(admin: any, ctx: any, args: any) {
      const vanIds = args.van_id ? [args.van_id] : await allowedVanIds(admin, ctx)
      if (args.van_id) assertVanAllowed(ctx, args.van_id)
      if (!vanIds.length) return { has_data: false }
      const date = args.date ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      return await routeAnalytics.getAnomalies(admin, ctx.businessId, vanIds[0], date)
    },
  },
  {
    name: 'get_loading_suggestion',
    description: "The suggested stock loading plan for a van's stop on a future date — how much of each stock item to prepare, with the historical basis for each suggestion, and how it compares to what's currently available. This is a suggestion only — nothing is transferred automatically.",
    input_schema: { type: 'object', properties: { van_id: { type: 'string' }, stop_name: { type: 'string' }, target_date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['van_id', 'stop_name', 'target_date'] },
    async handler(admin: any, ctx: any, args: any) {
      assertVanAllowed(ctx, args.van_id)
      const { data: stops } = await admin.from('van_schedule').select('id, location_name').eq('van_id', args.van_id).ilike('location_name', `%${args.stop_name}%`)
      if (!stops?.length) return { found: false, message: `No stop matching "${args.stop_name}" was found for that van.` }
      return await getLoadingPlan(admin, ctx.businessId, args.van_id, stops[0].id, args.target_date, 10)
    },
  },
  {
    name: 'get_stock_shortfall',
    description: "Which stock items are short of the suggested loading quantity for a van's stop on a given date — 'do I have enough cod for Friday'.",
    input_schema: { type: 'object', properties: { van_id: { type: 'string' }, stop_name: { type: 'string' }, target_date: { type: 'string' } }, required: ['van_id', 'stop_name', 'target_date'] },
    async handler(admin: any, ctx: any, args: any) {
      assertVanAllowed(ctx, args.van_id)
      const { data: stops } = await admin.from('van_schedule').select('id, location_name').eq('van_id', args.van_id).ilike('location_name', `%${args.stop_name}%`)
      if (!stops?.length) return { found: false, message: `No stop matching "${args.stop_name}" was found for that van.` }
      const plan = await getLoadingPlan(admin, ctx.businessId, args.van_id, stops[0].id, args.target_date, 10)
      return { shortfalls: (plan.items ?? []).filter((i: any) => i.shortfall && i.shortfall > 0) }
    },
  },
  {
    name: 'propose_stock_transfer',
    description: "Prepare a DRAFT stock transfer from a warehouse/source location to a van, for the user to review and confirm. Does NOT move any stock by itself.",
    input_schema: {
      type: 'object',
      properties: {
        van_id: { type: 'string' },
        items: { type: 'array', items: { type: 'object', properties: { stock_item_name: { type: 'string' }, quantity: { type: 'number' } }, required: ['stock_item_name', 'quantity'] } },
      },
      required: ['van_id', 'items'],
    },
    async handler(admin: any, ctx: any, args: any, conversationId: string) {
      if (!hasPermission(ctx.role, 'manage_stock')) return { proposed: false, message: "This account doesn't have permission to move stock." }
      assertVanAllowed(ctx, args.van_id)

      const { data: toLocation } = await admin.from('stock_locations').select('id').eq('van_id', args.van_id).maybeSingle()
      if (!toLocation) return { proposed: false, message: "This van doesn't have a stock location set up yet." }
      const { data: warehouse } = await admin.from('stock_locations').select('id').eq('business_id', ctx.businessId).eq('type', 'warehouse').limit(1).maybeSingle()
      if (!warehouse) return { proposed: false, message: 'No warehouse location is set up to transfer from yet.' }

      const resolvedItems = []
      for (const item of args.items) {
        const { data: stockItem } = await admin.from('stock_items').select('id, name, unit').eq('business_id', ctx.businessId).eq('active', true).ilike('name', `%${item.stock_item_name}%`).maybeSingle()
        if (!stockItem) return { proposed: false, message: `No stock item matching "${item.stock_item_name}" was found — nothing has been proposed.` }
        resolvedItems.push({ stock_item_id: stockItem.id, name: stockItem.name, unit: stockItem.unit, quantity: item.quantity })
      }

      const { data: pending, error } = await admin.from('ai_pending_actions').insert({
        business_id: ctx.businessId, user_id: ctx.userId, conversation_id: conversationId, action_type: 'create_stock_transfer',
        params: { van_id: args.van_id, from_location_id: warehouse.id, to_location_id: toLocation.id, items: resolvedItems },
        expires_at: new Date(Date.now() + 30 * 60000).toISOString(),
      }).select('id').single()
      if (error) throw new Error('pending_action_create_failed')

      return {
        proposed: true, pending_action_id: pending.id,
        items: resolvedItems.map((i: any) => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
        note: 'This is a DRAFT only. Nothing has been moved. The user must press Confirm in the app to actually create the transfer.',
      }
    },
  },
]
