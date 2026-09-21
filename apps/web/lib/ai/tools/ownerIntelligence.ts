// @ts-nocheck
// K44-K50 — FoodTaxi AI owner intelligence tools. Every handler is
// read-only (no propose_* tool here — see K17/K44: "no autonomous
// business management") and calls the exact same lib/commandCentre/*
// functions the /api/command-centre/* routes use, so the AI's answers can
// never disagree with the dashboard's own numbers. Every handler is
// gated by use_ai_owner_brief plus the more specific intelligence
// permission for finance/customer data, mirroring the API routes exactly.
import { hasPermission } from '@/lib/permissions'
import { allowedVanIds, assertVanAllowed } from '@/lib/ai/context'
import { resolveInclusiveDateRange, DATE_RANGE_OPTIONS } from '@/lib/ai/dateRange'
import { getKpiSnapshot } from '@/lib/commandCentre/kpi'
import { getAllVanSummaries, getVanSummary } from '@/lib/commandCentre/liveOps'
import { computeAllExceptions } from '@/lib/commandCentre/exceptions'
import { computeAllOpportunities } from '@/lib/commandCentre/opportunities'
import { getTomorrowReadiness, getTomorrowBusinessContext } from '@/lib/commandCentre/tomorrow'
import { getSupplierPriceChanges, getCostIncreaseVsPriceFlags, getMenuMarginReview } from '@/lib/commandCentre/supplierPrices'
import { getRetentionSummary } from '@/lib/crm/retention'
import { compareValues, priorWeekRange, priorMonthRange, isoStart } from '@/lib/commandCentre/comparison'
import { resolveDateRange } from '@/lib/ai/dateRange'

const OWNER_BRIEF_DENIED = { error: "This account doesn't have permission to use the FoodTaxi AI owner brief." }
const dateRangeSchema = { type: 'string', enum: DATE_RANGE_OPTIONS, description: 'Which period to report on.' }
const vanIdSchema = { type: 'string', description: "A specific van's id. Omit for all vans the caller can see." }

export const ownerIntelligenceTools = [
  {
    name: 'get_owner_brief',
    description: '"What needs my attention today?" / "How is the business doing today?" — today\'s KPI snapshot plus the highest-priority open exceptions. FACT/CALCULATION only; any explanation offered must be clearly labelled a possible explanation, never stated as the cause.',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasPermission(ctx.role, 'use_ai_owner_brief')) return OWNER_BRIEF_DENIED
      const vanIds = await allowedVanIds(admin, ctx)
      const today = new Date().toISOString().slice(0, 10)
      const [kpi, exceptions] = await Promise.all([
        getKpiSnapshot(admin, ctx.businessId, vanIds, { startIso: isoStart(today), endIso: new Date().toISOString(), startDate: today, endDate: today }),
        computeAllExceptions(admin, ctx.businessId, vanIds, isoStart(today)),
      ])
      return {
        data_period: `today (${today})`,
        kpi_today: kpi,
        top_exceptions: exceptions.slice(0, 8).map((e: any) => ({ priority: e.priority, title: e.title, detail: e.detail })),
        note: 'kpi_today figures are FACTS/CALCULATIONS from recorded data. Exceptions are SIGNALS, not confirmed causes.',
      }
    },
  },
  {
    name: 'get_live_operations',
    description: '"Which vans are trading?" — per-van trading status, current/next stop, GPS freshness, today\'s orders/revenue, staff on shift.',
    input_schema: { type: 'object', properties: { van_id: vanIdSchema } },
    async handler(admin: any, ctx: any, args: any) {
      if (!hasPermission(ctx.role, 'use_ai_owner_brief')) return OWNER_BRIEF_DENIED
      if (args.van_id) assertVanAllowed(ctx, args.van_id)
      const vanIds = args.van_id ? [args.van_id] : await allowedVanIds(admin, ctx)
      const { data: vans } = await admin.from('vans').select('id, name, tracking_status, accepts_online_orders').in('id', vanIds)
      return { vans: await getAllVanSummaries(admin, vans ?? []) }
    },
  },
  {
    name: 'get_van_summary',
    description: "A single van's factual summary component-by-component (trading, orders, stock/hygiene/vehicle alerts) — never a single opaque health score.",
    input_schema: { type: 'object', properties: { van_id: vanIdSchema }, required: ['van_id'] },
    async handler(admin: any, ctx: any, args: any) {
      if (!hasPermission(ctx.role, 'use_ai_owner_brief')) return OWNER_BRIEF_DENIED
      assertVanAllowed(ctx, args.van_id)
      const { data: van } = await admin.from('vans').select('id, name, tracking_status, accepts_online_orders').eq('id', args.van_id).maybeSingle()
      if (!van) return { found: false }
      return await getVanSummary(admin, van)
    },
  },
  {
    name: 'get_business_exceptions',
    description: '"What issues need my attention?" — the full deterministic exception list (stock, hygiene, vehicle, staff, finance, wastage, route-below-baseline) with the measurable evidence for each. An exception is a signal, never an invented cause.',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasPermission(ctx.role, 'use_ai_owner_brief')) return OWNER_BRIEF_DENIED
      const vanIds = await allowedVanIds(admin, ctx)
      const today = new Date().toISOString().slice(0, 10)
      const exceptions = await computeAllExceptions(admin, ctx.businessId, vanIds, isoStart(today))
      return { exceptions: exceptions.map((e: any) => ({ category: e.category, priority: e.priority, title: e.title, detail: e.detail, evidence: e.evidence })) }
    },
  },
  {
    name: 'get_business_opportunities',
    description: 'Rule-based opportunity signals (repeated sellouts, stock risk before a strong route, improving retention, high promo redemption) — each with WHAT/WHY/DATA PERIOD/EVIDENCE/DATA COVERAGE. Never executed automatically.',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasPermission(ctx.role, 'use_ai_owner_brief')) return OWNER_BRIEF_DENIED
      const vanIds = await allowedVanIds(admin, ctx)
      const today = new Date().toISOString().slice(0, 10)
      const prior = priorWeekRange(ctx.timezone)
      return { opportunities: await computeAllOpportunities(admin, ctx.businessId, vanIds, { start: today, end: today }, { start: prior.start.slice(0, 10), end: prior.end.slice(0, 10) }) }
    },
  },
  {
    name: 'get_period_comparison',
    description: '"Compare this week with last week" / "how does this month compare" — revenue, orders, AOV, known gross contribution, wastage and repeat-purchase-rate, current vs the prior calendar period, handling zero/missing prior data explicitly rather than showing a meaningless percentage.',
    input_schema: { type: 'object', properties: { period: { type: 'string', enum: ['week', 'month'] } }, required: ['period'] },
    async handler(admin: any, ctx: any, args: any) {
      if (!hasPermission(ctx.role, 'use_ai_owner_brief')) return OWNER_BRIEF_DENIED
      const vanIds = await allowedVanIds(admin, ctx)
      const currentRange = resolveDateRange(args.period === 'month' ? 'this_month' : 'this_week', ctx.timezone)
      const prior = args.period === 'month' ? priorMonthRange(ctx.timezone) : priorWeekRange(ctx.timezone)
      const [current, priorKpi] = await Promise.all([
        getKpiSnapshot(admin, ctx.businessId, vanIds, { startIso: currentRange.start, endIso: currentRange.end, startDate: currentRange.start.slice(0, 10), endDate: currentRange.end.slice(0, 10) }),
        getKpiSnapshot(admin, ctx.businessId, vanIds, { startIso: prior.start, endIso: prior.end, startDate: prior.start.slice(0, 10), endDate: prior.end.slice(0, 10) }),
      ])
      const metrics = ['revenue', 'orders', 'average_order_value', 'known_gross_contribution', 'wastage_cost', 'repeat_purchase_rate_pct']
      return {
        current_period: currentRange.label, prior_period: prior.label,
        comparisons: Object.fromEntries(metrics.map((m) => [m, compareValues(current[m], priorKpi[m])])),
      }
    },
  },
  {
    name: 'get_tomorrow_readiness',
    description: '"What should I prepare tomorrow?" — per-van route/staff/stock-shortfall/vehicle/hygiene readiness plus confirmed events and expected deliveries. Never marks anything ready without a real record backing it.',
    input_schema: { type: 'object', properties: { van_id: vanIdSchema } },
    async handler(admin: any, ctx: any, args: any) {
      if (!hasPermission(ctx.role, 'use_ai_owner_brief')) return OWNER_BRIEF_DENIED
      if (args.van_id) assertVanAllowed(ctx, args.van_id)
      const vanIds = args.van_id ? [args.van_id] : await allowedVanIds(admin, ctx)
      const { data: vans } = await admin.from('vans').select('id, name').in('id', vanIds)
      const [perVan, businessContext] = await Promise.all([
        Promise.all((vans ?? []).map((v: any) => getTomorrowReadiness(admin, ctx.businessId, v))),
        getTomorrowBusinessContext(admin, ctx.businessId),
      ])
      return { vans: perVan, ...businessContext }
    },
  },
  {
    name: 'get_supplier_price_changes',
    description: '"Which supplier prices changed?" — latest vs previous CONFIRMED purchase price per stock item, with dates and percentage change. Only uses received purchase orders, never unconfirmed OCR-extracted invoice data.',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasPermission(ctx.role, 'view_finance_intelligence')) return { error: "This account doesn't have permission to view supplier price intelligence." }
      return { price_changes: await getSupplierPriceChanges(admin, ctx.businessId), cost_increase_vs_unchanged_price: await getCostIncreaseVsPriceFlags(admin, ctx.businessId) }
    },
  },
  {
    name: 'get_margin_review',
    description: 'Menu item selling price, known cost, known gross contribution and cost coverage — "which items have the best margin". Never invents a cost for an item with no recipe/cost data linked.',
    input_schema: { type: 'object', properties: { van_id: vanIdSchema } },
    async handler(admin: any, ctx: any, args: any) {
      if (!hasPermission(ctx.role, 'view_finance_intelligence')) return { error: "This account doesn't have permission to view margin data." }
      if (args.van_id) assertVanAllowed(ctx, args.van_id)
      const vanIds = args.van_id ? [args.van_id] : await allowedVanIds(admin, ctx)
      return await getMenuMarginReview(admin, ctx.businessId, vanIds)
    },
  },
  {
    name: 'get_stock_risks',
    description: '"Which stock is at risk?" — items currently low/out of stock, itemised, from the exception engine.',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasPermission(ctx.role, 'view_stock_intelligence')) return { error: "This account doesn't have permission to view stock intelligence." }
      const vanIds = await allowedVanIds(admin, ctx)
      const today = new Date().toISOString().slice(0, 10)
      const exceptions = await computeAllExceptions(admin, ctx.businessId, vanIds, isoStart(today))
      return { stock_risks: exceptions.filter((e: any) => e.category === 'stock') }
    },
  },
  {
    name: 'get_customer_growth_summary',
    description: '"How is retention?" — new/returning/lapsed customers and repeat purchase rate for a period, from Phase I\'s own retention calculation.',
    input_schema: { type: 'object', properties: { date_range: dateRangeSchema }, required: ['date_range'] },
    async handler(admin: any, ctx: any, args: any) {
      if (!hasPermission(ctx.role, 'view_customer_intelligence')) return { error: "This account doesn't have permission to view customer intelligence." }
      const vanIds = await allowedVanIds(admin, ctx)
      const { label, startDate, endDate } = resolveInclusiveDateRange(args.date_range, ctx.timezone)
      return { period: label, ...(await getRetentionSummary(admin, ctx.businessId, vanIds, startDate, endDate)) }
    },
  },
  {
    name: 'get_finance_attention_items',
    description: '"Which invoices need attention?" — overdue supplier invoices and meaningful cash/card variances, from the exception engine.',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasPermission(ctx.role, 'view_finance_intelligence')) return { error: "This account doesn't have permission to view finance intelligence." }
      const vanIds = await allowedVanIds(admin, ctx)
      const today = new Date().toISOString().slice(0, 10)
      const exceptions = await computeAllExceptions(admin, ctx.businessId, vanIds, isoStart(today))
      return { finance_attention_items: exceptions.filter((e: any) => e.category === 'finance') }
    },
  },
]
