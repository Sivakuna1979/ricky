// @ts-nocheck
// M65-M70 — FoodTaxi Group AI tools. Every tool is READ-ONLY (this phase
// deliberately ships no group-level propose_*/write tool at all — see
// lib/ai/groupAssistant.ts's header comment for why). Every handler
// receives the server-resolved GroupContext (never anything the model or
// browser supplied for group_id/permissions/region) and computes strictly
// from lib/groups/dashboard.ts's own aggregation functions — never a
// second, AI-specific calculation of the same figures.
import { hasGroupPermission } from '@/lib/groups/permissions'
import {
  getGroupBusinessDirectory, getGroupKpiComparison, getGroupAttentionItems,
  getGroupStockSummary, getGroupHygieneSummary, getGroupCustomerGrowthSummary,
} from '@/lib/groups/dashboard'

export const groupTools = [
  {
    name: 'get_group_summary',
    description: 'Headline group overview — business count, today/this-week revenue and orders across authorised businesses. "How is the group doing".',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasGroupPermission(ctx.role, 'view_group_sales_summary')) return { error: "This account doesn't have permission to view group sales." }
      const kpis = await getGroupKpiComparison(admin, ctx.memberBusinessIds)
      return { business_count: ctx.memberBusinessIds.length, ...kpis }
    },
  },
  {
    name: 'get_group_live_operations',
    description: 'Business directory: which businesses are active/trading, van counts, region. "Which businesses do we have", "how many vans in the North region".',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasGroupPermission(ctx.role, 'view_group_businesses')) return { error: "This account doesn't have permission to view the business directory." }
      return { businesses: await getGroupBusinessDirectory(admin, ctx.memberBusinessIds) }
    },
  },
  {
    name: 'get_group_attention_items',
    description: 'Operational risks needing review across the group (stock, hygiene, vehicles, finance variances) — reused directly from each business’s own Command Centre, never re-derived. "What needs attention across the group".',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasGroupPermission(ctx.role, 'view_group_operations')) return { error: "This account doesn't have permission to view this." }
      const items = await getGroupAttentionItems(admin, ctx.memberBusinessIds)
      return { count: items.length, items: items.slice(0, 30) }
    },
  },
  {
    name: 'get_group_business_comparison',
    description: 'Factual per-business revenue/orders/AOV comparison for today — never an opaque score or ranking, just the measured figures side by side.',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasGroupPermission(ctx.role, 'view_group_sales_summary')) return { error: "This account doesn't have permission to view this." }
      return await getGroupKpiComparison(admin, ctx.memberBusinessIds)
    },
  },
  {
    name: 'get_group_stock_summary',
    description: 'Low/out-of-stock counts across the group, per business. "Which businesses are low on stock".',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasGroupPermission(ctx.role, 'view_group_stock_summary')) return { error: "This account doesn't have permission to view this." }
      return await getGroupStockSummary(admin, ctx.memberBusinessIds)
    },
  },
  {
    name: 'get_group_hygiene_summary',
    description: 'Hygiene-check completion across the group over the last 7 days — a factual completion count, never a compliance certification.',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasGroupPermission(ctx.role, 'view_group_hygiene')) return { error: "This account doesn't have permission to view this." }
      return await getGroupHygieneSummary(admin, ctx.memberBusinessIds)
    },
  },
  {
    name: 'get_group_customer_growth_summary',
    description: 'New-customer counts across the group over the last 30 days, aggregate only — never individual customer names or contact details (not available to any group role).',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasGroupPermission(ctx.role, 'view_group_customer_summary')) return { error: "This account doesn't have permission to view this." }
      return await getGroupCustomerGrowthSummary(admin, ctx.memberBusinessIds)
    },
  },
  {
    name: 'get_group_event_summary',
    description: 'Group-sourced event opportunities and how many member businesses have applied — participation counts only.',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasGroupPermission(ctx.role, 'view_group_operations')) return { error: "This account doesn't have permission to view this." }
      const { data: events } = await admin.from('event_requests').select('id, event_date, admin_status').eq('group_id', ctx.groupId)
      return { events: events ?? [] }
    },
  },
]

export const GROUP_TOOLS_BY_NAME = Object.fromEntries(groupTools.map(t => [t.name, t]))
export function groupToolDefinitions() {
  return groupTools.map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema }))
}
