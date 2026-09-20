// @ts-nocheck
// H60–H65 — FoodTaxi AI finance tools. Read-only except propose_expense,
// which — exactly like Phase E's propose_purchase_order and Phase G's
// propose_stock_transfer — only ever creates a PENDING ai_pending_actions
// row for the user to confirm themselves. The AI can never record a
// payment, void an invoice, issue a refund, change VAT status, lock a
// period, or delete anything (H65) — none of those actions exist as a
// tool here at all, not even a gated one.
import { getSalesSummary } from '@/lib/finance/revenue'
import { getExpenseSummary } from '@/lib/finance/expenses'
import { getCogsSummary } from '@/lib/finance/cogs'
import { getVatSummary } from '@/lib/finance/vat'
import { getVehicleCosts, getEquipmentCosts, getManagementReport } from '@/lib/finance/reports'
import { getReviewQueue } from '@/lib/finance/review'
import { resolveFinanceRange } from '@/lib/finance/dateRange'
import { allowedVanIds, assertVanAllowed } from '@/lib/ai/context'
import { hasPermission } from '@/lib/permissions'
import { round2 } from '@/lib/finance/money'
import { DATE_RANGE_OPTIONS } from '@/lib/ai/dateRange'

const dateRangeSchema = { type: 'string', enum: DATE_RANGE_OPTIONS, description: 'Which period to report on.' }
const vanIdSchema = { type: 'string', description: "A specific van's id. Omit for all vans the caller can see." }

function rangeParams(url: URLSearchParams) { return resolveFinanceRange(url, 'Europe/London') }
function fakeParams(option: string) { const p = new URLSearchParams(); p.set('range', option); return p }

export const financeTools = [
  {
    name: 'get_finance_summary',
    description: "\"What did I take today\" style overview: net revenue (after refunds), orders, known gross contribution, expenses, vehicle/equipment costs and open review-queue count for a period.",
    input_schema: { type: 'object', properties: { date_range: dateRangeSchema, van_id: vanIdSchema }, required: ['date_range'] },
    async handler(admin: any, ctx: any, args: any) {
      if (!hasPermission(ctx.role, 'view_finance_summary')) return { error: "This account doesn't have permission to view finance data." }
      if (args.van_id) assertVanAllowed(ctx, args.van_id)
      const { data: business } = await admin.from('businesses').select('timezone').eq('id', ctx.businessId).maybeSingle()
      const range = resolveFinanceRange(fakeParams(args.date_range), business?.timezone ?? 'Europe/London')
      const vanIds = args.van_id ? [args.van_id] : await allowedVanIds(admin, ctx)

      const [sales, expenses, cogs, vehicle, equipment] = await Promise.all([
        hasPermission(ctx.role, 'view_sales_finance') ? getSalesSummary(admin, ctx.businessId, { vanIds, startIso: range.startIso, endIso: range.endIso }) : null,
        hasPermission(ctx.role, 'view_expenses') ? getExpenseSummary(admin, ctx.businessId, { startDate: range.startDate, endDate: range.endDate, vanId: args.van_id }) : null,
        hasPermission(ctx.role, 'view_sales_finance') ? getCogsSummary(admin, ctx.businessId, { vanIds, startIso: range.startIso, endIso: range.endIso, startDate: range.startDate, endDate: range.endDate }) : null,
        getVehicleCosts(admin, ctx.businessId, vanIds, range.startDate, range.endDate),
        getEquipmentCosts(admin, ctx.businessId, vanIds, range.startDate, range.endDate),
      ])
      return { period: range.label, sales, expenses, gross_contribution: cogs, vehicle_costs: vehicle.total, equipment_costs: equipment.total }
    },
  },
  {
    name: 'get_expenses_summary',
    description: 'Expense totals by category for a period — "how much did I spend this month", "what did I spend on fuel".',
    input_schema: { type: 'object', properties: { date_range: dateRangeSchema } , required: ['date_range']},
    async handler(admin: any, ctx: any, args: any) {
      if (!hasPermission(ctx.role, 'view_expenses')) return { error: "This account doesn't have permission to view expenses." }
      const { data: business } = await admin.from('businesses').select('timezone').eq('id', ctx.businessId).maybeSingle()
      const range = resolveFinanceRange(fakeParams(args.date_range), business?.timezone ?? 'Europe/London')
      return { period: range.label, ...(await getExpenseSummary(admin, ctx.businessId, { startDate: range.startDate, endDate: range.endDate })) }
    },
  },
  {
    name: 'get_gross_contribution',
    description: "Known product cost and gross contribution (revenue minus known COGS) for a period, with a coverage percentage — never called 'profit'.",
    input_schema: { type: 'object', properties: { date_range: dateRangeSchema, van_id: vanIdSchema }, required: ['date_range'] },
    async handler(admin: any, ctx: any, args: any) {
      if (!hasPermission(ctx.role, 'view_sales_finance')) return { error: "This account doesn't have permission to view this." }
      if (args.van_id) assertVanAllowed(ctx, args.van_id)
      const { data: business } = await admin.from('businesses').select('timezone').eq('id', ctx.businessId).maybeSingle()
      const range = resolveFinanceRange(fakeParams(args.date_range), business?.timezone ?? 'Europe/London')
      const vanIds = args.van_id ? [args.van_id] : await allowedVanIds(admin, ctx)
      return { period: range.label, ...(await getCogsSummary(admin, ctx.businessId, { vanIds, startIso: range.startIso, endIso: range.endIso, startDate: range.startDate, endDate: range.endDate })) }
    },
  },
  {
    name: 'get_vehicle_costs',
    description: 'How much a van (or all vans) cost to operate over a period — vehicle maintenance + equipment costs.',
    input_schema: { type: 'object', properties: { date_range: dateRangeSchema, van_id: vanIdSchema }, required: ['date_range'] },
    async handler(admin: any, ctx: any, args: any) {
      if (args.van_id) assertVanAllowed(ctx, args.van_id)
      const { data: business } = await admin.from('businesses').select('timezone').eq('id', ctx.businessId).maybeSingle()
      const range = resolveFinanceRange(fakeParams(args.date_range), business?.timezone ?? 'Europe/London')
      const vanIds = args.van_id ? [args.van_id] : await allowedVanIds(admin, ctx)
      const [vehicle, equipment] = await Promise.all([
        getVehicleCosts(admin, ctx.businessId, vanIds, range.startDate, range.endDate),
        getEquipmentCosts(admin, ctx.businessId, vanIds, range.startDate, range.endDate),
      ])
      return { period: range.label, vehicle_costs: vehicle, equipment_costs: equipment }
    },
  },
  {
    name: 'get_supplier_invoice_status',
    description: "Which supplier invoices are unpaid, overdue, or partially paid, and totals — \"what invoices are unpaid\".",
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasPermission(ctx.role, 'view_expenses')) return { error: "This account doesn't have permission to view supplier invoices." }
      const { data: invoices } = await admin.from('supplier_invoices').select('id, invoice_number, invoice_date, due_date, gross_amount, status, supplier_records(supplier_name)').eq('business_id', ctx.businessId).in('status', ['UNPAID', 'PARTIALLY_PAID', 'REVIEW'])
      const today = new Date().toISOString().slice(0, 10)
      const rows = (invoices ?? []).map((i: any) => ({ supplier: i.supplier_records?.supplier_name, invoice_number: i.invoice_number, gross_amount: i.gross_amount, status: i.status, overdue: i.due_date ? i.due_date < today : false }))
      return { open_invoices: rows.length, total_outstanding_gross: round2(rows.reduce((s: number, r: any) => s + r.gross_amount, 0)), overdue_count: rows.filter((r: any) => r.overdue).length, invoices: rows }
    },
  },
  {
    name: 'get_cash_variance',
    description: "Recent cash-count variances (actual vs expected) by van — \"how much cash should be in the van\", \"was there a cash shortfall\".",
    input_schema: { type: 'object', properties: { van_id: vanIdSchema } },
    async handler(admin: any, ctx: any, args: any) {
      if (!hasPermission(ctx.role, 'view_cash_variance')) return { error: "This account doesn't have permission to view cash reconciliation." }
      if (args.van_id) assertVanAllowed(ctx, args.van_id)
      let query = admin.from('cash_reconciliations').select('service_date, expected_cash, actual_cash, variance, vans(name)').eq('business_id', ctx.businessId).order('service_date', { ascending: false }).limit(14)
      if (args.van_id) query = query.eq('van_id', args.van_id)
      const { data } = await query
      return { counts: data ?? [] }
    },
  },
  {
    name: 'get_vat_summary',
    description: 'Recorded output VAT, input VAT and the difference for a period. This is a FoodTaxi record summary, not a filed return — never advise on VAT treatment beyond what is configured.',
    input_schema: { type: 'object', properties: { date_range: dateRangeSchema }, required: ['date_range'] },
    async handler(admin: any, ctx: any, args: any) {
      if (!hasPermission(ctx.role, 'view_vat')) return { error: "This account doesn't have permission to view VAT data." }
      const { data: business } = await admin.from('businesses').select('timezone').eq('id', ctx.businessId).maybeSingle()
      const range = resolveFinanceRange(fakeParams(args.date_range), business?.timezone ?? 'Europe/London')
      const vanIds = await allowedVanIds(admin, ctx)
      return { period: range.label, ...(await getVatSummary(admin, ctx.businessId, { vanIds, ...range })) }
    },
  },
  {
    name: 'get_finance_review_items',
    description: 'Open items in the finance review queue (duplicate expenses, unknown VAT, invoice/PO mismatches, cash/card variances, uncategorised expenses) — "what expenses need reviewing".',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasPermission(ctx.role, 'view_finance_summary')) return { error: "This account doesn't have permission to view this." }
      return { items: await getReviewQueue(admin, ctx.businessId, 'OPEN') }
    },
  },
  {
    name: 'get_management_report',
    description: 'Sales minus known COGS = gross contribution, recorded operating expenses, recorded operating result — a management summary, never statutory accounts or a claim of net profit.',
    input_schema: { type: 'object', properties: { date_range: dateRangeSchema }, required: ['date_range'] },
    async handler(admin: any, ctx: any, args: any) {
      if (!hasPermission(ctx.role, 'view_finance_summary')) return { error: "This account doesn't have permission to view this." }
      const { data: business } = await admin.from('businesses').select('timezone').eq('id', ctx.businessId).maybeSingle()
      const range = resolveFinanceRange(fakeParams(args.date_range), business?.timezone ?? 'Europe/London')
      const vanIds = await allowedVanIds(admin, ctx)
      return await getManagementReport(admin, ctx.businessId, { vanIds, ...range })
    },
  },
  {
    name: 'propose_expense',
    description: 'Prepare a DRAFT expense for the user to review and confirm. Does NOT create a real expense by itself — use when the user describes a cost they want logged (e.g. "log a £40 fuel expense today").',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string' }, category: { type: 'string', enum: ['food_stock', 'drinks', 'packaging', 'fuel', 'vehicle', 'repairs', 'equipment', 'insurance', 'rent_storage', 'phone_internet', 'marketing', 'staff', 'cleaning', 'professional_fees', 'other'] },
        net_amount: { type: 'number' }, vat_amount: { type: 'number' }, expense_date: { type: 'string', description: 'YYYY-MM-DD, defaults to today' },
        supplier_name: { type: 'string' }, van_id: vanIdSchema,
      },
      required: ['description', 'category', 'net_amount'],
    },
    async handler(admin: any, ctx: any, args: any, conversationId: string) {
      if (!hasPermission(ctx.role, 'create_expense')) return { proposed: false, message: "This account doesn't have permission to create expenses." }
      if (args.van_id) assertVanAllowed(ctx, args.van_id)

      let supplierId: string | null = null
      if (args.supplier_name) {
        const { data: supplier } = await admin.from('supplier_records').select('id, supplier_name').eq('business_id', ctx.businessId).eq('is_active', true).ilike('supplier_name', `%${args.supplier_name}%`).maybeSingle()
        supplierId = supplier?.id ?? null
      }

      const net = round2(Number(args.net_amount))
      const vat = round2(Number(args.vat_amount ?? 0))
      const gross = round2(net + vat)
      const { data: pending, error } = await admin.from('ai_pending_actions').insert({
        business_id: ctx.businessId, user_id: ctx.userId, conversation_id: conversationId, action_type: 'create_expense',
        params: { description: args.description, category: args.category, net_amount: net, vat_amount: vat, gross_amount: gross, expense_date: args.expense_date ?? new Date().toISOString().slice(0, 10), supplier_id: supplierId, van_id: args.van_id ?? null },
        expires_at: new Date(Date.now() + 30 * 60000).toISOString(),
      }).select('id').single()
      if (error) throw new Error('pending_action_create_failed')

      return { proposed: true, pending_action_id: pending.id, description: args.description, gross_amount: gross, note: 'This is a DRAFT only. Nothing has been recorded. The user must press Confirm in the app to actually create the expense.' }
    },
  },
]
