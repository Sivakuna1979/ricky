// @ts-nocheck
// get_attention_summary is the direct implementation of E18 ("what needs
// my attention today") — it only ever reports items a real query found;
// it never invents urgency for a quiet day.
import { scheduleDayOfWeek } from '@/lib/schedule/dayOfWeek'

export const operationsTools = [
  {
    name: 'get_automation_alerts',
    description: "Recent unread FoodTaxi notifications/alerts (from the automation system) — low stock, hygiene, vehicle, staff, event alerts etc.",
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      const { data: userIds } = await admin.from('users').select('id').eq('id', ctx.userId)
      const { data } = await admin.from('notifications').select('title, body, data, sent_at').eq('user_id', ctx.userId).eq('is_read', false).order('sent_at', { ascending: false }).limit(20)
      return { unread_alerts: (data ?? []).map((n: any) => ({ title: n.title, body: n.body, category: n.data?.category, priority: n.data?.priority, at: n.sent_at })) }
    },
  },
  {
    name: 'get_van_schedule',
    description: "A van's weekly recurring stop schedule for a given date (defaults to today), or all vans if none specified.",
    input_schema: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD, defaults to today.' }, van_id: { type: 'string' } } },
    async handler(admin: any, ctx: any, args: any) {
      const date = args.date ?? new Date().toISOString().slice(0, 10)
      // Fixed during the Phase G data audit (G1) — was querying
      // van_schedule (0=Mon) with a raw JS getUTCDay() (0=Sun) value.
      const dow = scheduleDayOfWeek(new Date(`${date}T00:00:00Z`))
      let vansQuery = admin.from('vans').select('id, name').eq('business_id', ctx.businessId).eq('is_active', true)
      if (args.van_id) vansQuery = vansQuery.eq('id', args.van_id)
      const { data: vans } = await vansQuery
      if (!vans?.length) return { date, schedule: [] }
      const { data: stops } = await admin.from('van_schedule').select('van_id, location_name, arrival_time, departure_time').in('van_id', vans.map((v: any) => v.id)).eq('day_of_week', dow).order('arrival_time')
      return {
        date,
        schedule: vans.map((v: any) => ({
          van: v.name,
          stops: (stops ?? []).filter((s: any) => s.van_id === v.id).map((s: any) => ({ location: s.location_name, arrival: s.arrival_time, departure: s.departure_time })),
        })),
      }
    },
  },
  {
    name: 'get_attention_summary',
    description: "Combines stock, hygiene, staff, vehicle, equipment, purchase order and event data into a single 'what needs my attention today' list. Use this for broad daily-check-in questions rather than calling every individual tool.",
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      const today = new Date().toISOString().slice(0, 10)
      const items: string[] = []

      const { data: stockItems } = await admin.from('stock_items').select('id, name, minimum_quantity').eq('business_id', ctx.businessId).eq('active', true)
      const { data: levels } = await admin.from('stock_levels').select('stock_item_id, quantity')
      const totals: Record<string, number> = {}
      for (const l of levels ?? []) totals[l.stock_item_id] = (totals[l.stock_item_id] ?? 0) + (l.quantity ?? 0)
      const lowCount = (stockItems ?? []).filter((i: any) => { const q = totals[i.id] ?? 0; return q > 0 && q <= i.minimum_quantity }).length
      const outCount = (stockItems ?? []).filter((i: any) => (totals[i.id] ?? 0) <= 0).length
      if (lowCount) items.push(`${lowCount} stock item${lowCount === 1 ? '' : 's'} below minimum`)
      if (outCount) items.push(`${outCount} item${outCount === 1 ? '' : 's'} out of stock`)

      const { data: vans } = await admin.from('vans').select('id, name').eq('business_id', ctx.businessId).eq('is_active', true)
      const vanIds = (vans ?? []).map((v: any) => v.id)
      const { data: logs } = vanIds.length ? await admin.from('hygiene_logs').select('van_id, log_type').gte('recorded_at', `${today}T00:00:00`).in('van_id', vanIds) : { data: [] }
      const openingDone = new Set((logs ?? []).filter((l: any) => l.log_type === 'opening_checklist').map((l: any) => l.van_id))
      const missingOpening = vanIds.filter(id => !openingDone.has(id)).length
      if (missingOpening) items.push(`${missingOpening} van${missingOpening === 1 ? '' : 's'} missing today's opening hygiene check`)

      const { data: vehicles } = await admin.from('vehicle_details').select('mot_expiry, insurance_expiry, tax_expiry, service_due_date, vans(name)').eq('business_id', ctx.businessId)
      const soon = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)
      let vehicleAlerts = 0
      for (const v of vehicles ?? []) for (const f of ['mot_expiry', 'insurance_expiry', 'tax_expiry', 'service_due_date']) if (v[f] && v[f] <= soon) vehicleAlerts++
      if (vehicleAlerts) items.push(`${vehicleAlerts} vehicle renewal${vehicleAlerts === 1 ? '' : 's'} due within 14 days`)

      const { count: poCount } = await admin.from('purchase_orders').select('id', { count: 'exact', head: true }).eq('business_id', ctx.businessId).in('status', ['ORDERED', 'PARTIALLY_RECEIVED'])
      if (poCount) items.push(`${poCount} purchase order${poCount === 1 ? '' : 's'} awaiting delivery`)

      const { data: business } = await admin.from('businesses').select('email').eq('id', ctx.businessId).maybeSingle()
      let eventCount = 0
      if (business?.email) {
        const { data: apps } = await admin.from('event_applications').select('event_id').eq('van_owner_email', business.email).eq('status', 'interested')
        eventCount = apps?.length ?? 0
      }
      if (eventCount) items.push(`${eventCount} event application${eventCount === 1 ? '' : 's'} awaiting confirmation`)

      return { date: today, attention_items: items, all_clear: items.length === 0 }
    },
  },
]
