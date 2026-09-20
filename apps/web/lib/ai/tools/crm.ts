// @ts-nocheck
// I55–I60 — FoodTaxi AI CRM tools. Every tool returns AGGREGATES/COUNTS
// only — never a raw customer list or contact details (I60: "do not send
// entire customer databases to Claude"). The one write-capable tool,
// propose_campaign, only ever creates a DRAFT campaign — exactly like
// Phase E/G/H's other propose_* tools, it can never send anything by
// itself (I57/I59).
import { getRetentionSummary, getReorderWithinDays } from '@/lib/crm/retention'
import { getCustomerAggregates, computeSegmentMembership, SEGMENT_DEFINITIONS } from '@/lib/crm/segments'
import { getLoyaltySettings } from '@/lib/crm/loyalty'
import { getReviewSummary } from '@/lib/crm/feedback'
import { estimateRecipientCount } from '@/lib/crm/campaigns'
import { hasPermission } from '@/lib/permissions'
import { allowedVanIds } from '@/lib/ai/context'
import { resolveFinanceRange } from '@/lib/finance/dateRange'

const SEGMENT_KEYS = SEGMENT_DEFINITIONS.map(s => s.key)

async function rangeFor(admin: any, ctx: any, option: string) {
  const { data: business } = await admin.from('businesses').select('timezone').eq('id', ctx.businessId).maybeSingle()
  const params = new URLSearchParams(); params.set('range', option)
  return resolveFinanceRange(params, business?.timezone ?? 'Europe/London')
}

export const crmTools = [
  {
    name: 'get_customer_growth_summary',
    description: 'New vs returning customers, repeat purchase rate and average orders/customer for a period — "how many customers came back this month".',
    input_schema: { type: 'object', properties: { date_range: { type: 'string', enum: ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month'] } }, required: ['date_range'] },
    async handler(admin: any, ctx: any, args: any) {
      if (!hasPermission(ctx.role, 'view_marketing_analytics')) return { error: "This account doesn't have permission to view this." }
      const vanIds = await allowedVanIds(admin, ctx)
      const range = await rangeFor(admin, ctx, args.date_range)
      const summary = await getRetentionSummary(admin, ctx.businessId, vanIds, range.startDate, range.endDate)
      return { period: range.label, ...summary }
    },
  },
  {
    name: 'get_lapsed_customer_count',
    description: '"How many customers haven\'t ordered for 60 days" — a factual count, no names/contact details returned.',
    input_schema: { type: 'object', properties: { days: { type: 'number', description: 'Defaults to 60' } } },
    async handler(admin: any, ctx: any, args: any) {
      if (!hasPermission(ctx.role, 'view_marketing_analytics')) return { error: "This account doesn't have permission to view this." }
      const vanIds = await allowedVanIds(admin, ctx)
      const aggregates = await getCustomerAggregates(admin, ctx.businessId, vanIds)
      const days = args.days ?? 60
      let count = 0
      for (const agg of aggregates.values()) if (computeSegmentMembership(agg, 'lapsed', { lapsedDays: days })) count++
      return { lapsed_days_threshold: days, lapsed_customers: count, total_known_customers: aggregates.size }
    },
  },
  {
    name: 'get_customer_segment_summary',
    description: `Count of customers in a deterministic segment (${SEGMENT_KEYS.join(', ')}) — "how many regular customers do we have". Never infers a segment beyond these fixed, documented definitions.`,
    input_schema: { type: 'object', properties: { segment: { type: 'string', enum: SEGMENT_KEYS } }, required: ['segment'] },
    async handler(admin: any, ctx: any, args: any) {
      if (!hasPermission(ctx.role, 'view_marketing_analytics')) return { error: "This account doesn't have permission to view this." }
      const vanIds = await allowedVanIds(admin, ctx)
      const aggregates = await getCustomerAggregates(admin, ctx.businessId, vanIds)
      let count = 0
      for (const agg of aggregates.values()) if (computeSegmentMembership(agg, args.segment)) count++
      return { segment: args.segment, count, definition: SEGMENT_DEFINITIONS.find(s => s.key === args.segment)?.description }
    },
  },
  {
    name: 'get_reorder_rate',
    description: '"How many customers ordered again within X days of their first order" — I49\'s precise reorder-rate metric.',
    input_schema: { type: 'object', properties: { within_days: { type: 'number', description: 'Defaults to 30' } } },
    async handler(admin: any, ctx: any, args: any) {
      if (!hasPermission(ctx.role, 'view_marketing_analytics')) return { error: "This account doesn't have permission to view this." }
      const vanIds = await allowedVanIds(admin, ctx)
      return await getReorderWithinDays(admin, ctx.businessId, vanIds, args.within_days ?? 30)
    },
  },
  {
    name: 'get_loyalty_summary',
    description: '"How is our loyalty programme doing" — configuration, member count, and total points earned/redeemed.',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasPermission(ctx.role, 'view_marketing_analytics')) return { error: "This account doesn't have permission to view this." }
      const settings = await getLoyaltySettings(admin, ctx.businessId)
      if (!settings.enabled) return { enabled: false, message: 'Loyalty is not enabled for this business.' }
      const { count: members } = await admin.from('crm_customers').select('id', { count: 'exact', head: true }).eq('business_id', ctx.businessId).eq('loyalty_enrolled', true)
      const { data: ledger } = await admin.from('loyalty_ledger').select('type, points_delta').eq('business_id', ctx.businessId)
      const earned = (ledger ?? []).filter((l: any) => l.type === 'EARN').reduce((s: number, l: any) => s + l.points_delta, 0)
      const redeemed = (ledger ?? []).filter((l: any) => l.type === 'REDEEM').reduce((s: number, l: any) => s + Math.abs(l.points_delta), 0)
      const redemptionCount = (ledger ?? []).filter((l: any) => l.type === 'REDEEM').length
      return { enabled: true, programme_name: settings.programme_name, earning_method: settings.earning_method, reward_threshold: settings.reward_threshold, members: members ?? 0, total_points_earned: earned, total_points_redeemed: redeemed, total_rewards_redeemed: redemptionCount }
    },
  },
  {
    name: 'get_promo_performance',
    description: '"Which promotion had the most redemptions" — redemption counts and total discount given per active promo code.',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasPermission(ctx.role, 'view_marketing_analytics')) return { error: "This account doesn't have permission to view this." }
      const { data: promos } = await admin.from('promo_codes').select('id, code, is_active').eq('business_id', ctx.businessId)
      const ids = (promos ?? []).map((p: any) => p.id)
      const { data: redemptions } = ids.length ? await admin.from('promo_redemptions').select('promo_code_id, discount_amount').in('promo_code_id', ids) : { data: [] }
      const byPromo: Record<string, { count: number; total_discount: number }> = {}
      for (const r of redemptions ?? []) { byPromo[r.promo_code_id] ??= { count: 0, total_discount: 0 }; byPromo[r.promo_code_id].count++; byPromo[r.promo_code_id].total_discount += r.discount_amount }
      return { promos: (promos ?? []).map((p: any) => ({ code: p.code, is_active: p.is_active, redemptions: byPromo[p.id]?.count ?? 0, total_discount_given: byPromo[p.id]?.total_discount ?? 0 })).sort((a: any, b: any) => b.redemptions - a.redemptions) }
    },
  },
  {
    name: 'get_review_summary',
    description: '"What are customers saying in reviews" — average rating, count, rating distribution and monthly trend. Never overinterprets a small sample.',
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      if (!hasPermission(ctx.role, 'view_marketing_analytics')) return { error: "This account doesn't have permission to view this." }
      return await getReviewSummary(admin, ctx.businessId)
    },
  },
  {
    name: 'get_campaign_performance',
    description: 'Sent/delivered/failed counts and estimated recipients for recent campaigns.',
    input_schema: { type: 'object', properties: { limit: { type: 'number', description: 'Defaults to 5' } } },
    async handler(admin: any, ctx: any, args: any) {
      if (!hasPermission(ctx.role, 'view_marketing_analytics')) return { error: "This account doesn't have permission to view this." }
      const { data: campaigns } = await admin.from('campaigns').select('id, name, channel, status, estimated_recipients, sent_at').eq('business_id', ctx.businessId).order('created_at', { ascending: false }).limit(args.limit ?? 5)
      const ids = (campaigns ?? []).map((c: any) => c.id)
      const { data: recipients } = ids.length ? await admin.from('campaign_recipients').select('campaign_id, status').in('campaign_id', ids) : { data: [] }
      const statsById: Record<string, Record<string, number>> = {}
      for (const r of recipients ?? []) { statsById[r.campaign_id] ??= {}; statsById[r.campaign_id][r.status] = (statsById[r.campaign_id][r.status] ?? 0) + 1 }
      return { campaigns: (campaigns ?? []).map((c: any) => ({ name: c.name, channel: c.channel, status: c.status, estimated_recipients: c.estimated_recipients, delivery: statsById[c.id] ?? {} })) }
    },
  },
  {
    name: 'propose_campaign',
    description: "Prepare a DRAFT marketing campaign (audience segment + channel + message) for the user to review and confirm themselves. Does NOT create, send or schedule anything by itself — even the DRAFT campaign row is only created once the user confirms (I59's server-controlled confirmation, same framework as every other propose_* tool). Audience must be one of the fixed deterministic segments — never a description of sensitive personal traits.",
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' }, channel: { type: 'string', enum: ['email', 'whatsapp', 'sms'] },
        segment: { type: 'string', enum: ['all', ...SEGMENT_KEYS] },
        subject: { type: 'string', description: 'Email only' }, message: { type: 'string' },
        campaign_type: { type: 'string', enum: ['general', 'win_back', 'route_customer', 'closure_notice', 'offer'] },
      },
      required: ['name', 'channel', 'segment', 'message'],
    },
    async handler(admin: any, ctx: any, args: any, conversationId: string) {
      if (!hasPermission(ctx.role, 'manage_campaigns')) return { proposed: false, message: "This account doesn't have permission to draft campaigns." }
      if (args.channel === 'email' && !args.subject) return { proposed: false, message: 'An email campaign needs a subject.' }

      const segmentDefinition = { type: args.segment }
      const estimatedRecipients = await estimateRecipientCount(admin, ctx.businessId, args.channel, segmentDefinition)
      const { data: pending, error } = await admin.from('ai_pending_actions').insert({
        business_id: ctx.businessId, user_id: ctx.userId, conversation_id: conversationId, action_type: 'create_campaign_draft',
        params: { name: args.name, channel: args.channel, segment_definition: segmentDefinition, subject: args.subject ?? null, message: args.message, campaign_type: args.campaign_type ?? 'general', estimated_recipients: estimatedRecipients },
        expires_at: new Date(Date.now() + 30 * 60000).toISOString(),
      }).select('id').single()
      if (error) throw new Error('pending_action_create_failed')

      return {
        proposed: true, pending_action_id: pending.id, estimated_recipients: estimatedRecipients,
        note: 'This is a DRAFT proposal only. Nothing has been created, sent or scheduled. The user must press Confirm in the app, and even then this only creates a DRAFT campaign — sending it is a separate, explicit step under Customers → Campaigns.',
      }
    },
  },
]
