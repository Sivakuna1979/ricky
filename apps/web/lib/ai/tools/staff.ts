// @ts-nocheck
import { resolveDateRange, DATE_RANGE_OPTIONS } from '@/lib/ai/dateRange'
import { round2 } from '@/lib/ai/queries/orders'

const dateRangeSchema = { type: 'string', enum: DATE_RANGE_OPTIONS, description: 'Which period to report on.' }

// Deliberately returns only name/role/van — not phone/email or other
// personal details (E13, E27). Business analytics stays aggregated.
export const staffTools = [
  {
    name: 'get_staff_working',
    description: "Who is scheduled to work today (or 'tomorrow' via a shift date lookup is not supported — use today only for now), optionally for one van.",
    input_schema: { type: 'object', properties: { van_id: { type: 'string', description: 'Optional — a specific van.' } } },
    async handler(admin: any, ctx: any, args: any) {
      const today = new Date().toISOString().slice(0, 10)
      let query = admin.from('shifts').select('start_time, end_time, staff(users(full_name)), vans(name)').eq('business_id', ctx.businessId).eq('shift_date', today)
      if (args.van_id) query = query.eq('van_id', args.van_id)
      const { data } = await query
      return {
        date: today,
        shifts: (data ?? []).map((s: any) => ({ name: s.staff?.users?.full_name ?? 'Unknown', van: s.vans?.name ?? null, start_time: s.start_time, end_time: s.end_time })),
      }
    },
  },
  {
    name: 'get_timesheet_summary',
    description: 'Total staff hours worked for a period, broken down by staff member.',
    input_schema: { type: 'object', properties: { date_range: dateRangeSchema }, required: ['date_range'] },
    async handler(admin: any, ctx: any, args: any) {
      const { label, start, end } = resolveDateRange(args.date_range, ctx.timezone)
      const { data } = await admin.from('time_entries').select('clock_in_at, clock_out_at, staff(users(full_name))').eq('business_id', ctx.businessId).gte('clock_in_at', start).lt('clock_in_at', end)
      const byStaff: Record<string, number> = {}
      let openEntries = 0
      for (const e of data ?? []) {
        const name = e.staff?.users?.full_name ?? 'Unknown'
        if (!e.clock_out_at) { openEntries++; continue }
        const minutes = (new Date(e.clock_out_at).getTime() - new Date(e.clock_in_at).getTime()) / 60000
        byStaff[name] = (byStaff[name] ?? 0) + minutes
      }
      return {
        period: label,
        total_hours: round2(Object.values(byStaff).reduce((s, m) => s + m, 0) / 60),
        by_staff: Object.entries(byStaff).map(([name, minutes]) => ({ name, hours: round2(minutes / 60) })),
        currently_clocked_in_without_clockout: openEntries,
      }
    },
  },
]
