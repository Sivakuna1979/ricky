// @ts-nocheck
// H6 — today/yesterday/this week/last week/this month/last month/custom,
// reusing Phase E/G's existing deterministic resolvers rather than a
// third date-parsing implementation. `custom` is the one option those
// resolvers don't have — handled directly here from explicit start/end
// query params.
import { resolveDateRange, resolveInclusiveDateRange, DATE_RANGE_OPTIONS } from '@/lib/ai/dateRange'

export function resolveFinanceRange(searchParams: URLSearchParams, timezone: string) {
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (start && end) {
    const endExclusiveIso = new Date(new Date(`${end}T00:00:00Z`).getTime() + 86400000).toISOString()
    return { label: 'custom', startDate: start, endDate: end, startIso: `${start}T00:00:00.000Z`, endIso: endExclusiveIso }
  }
  const option = (searchParams.get('range') ?? 'today') as any
  const opt = DATE_RANGE_OPTIONS.includes(option) ? option : 'today'
  const { label, start: startIso, end: endIso } = resolveDateRange(opt, timezone)
  const { startDate, endDate } = resolveInclusiveDateRange(opt, timezone)
  return { label, startDate, endDate, startIso, endIso }
}
