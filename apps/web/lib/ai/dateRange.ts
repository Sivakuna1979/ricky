// @ts-nocheck
// Deterministic, server-side date-phrase resolution (E8, E33) — Claude
// never calculates dates itself. Its tool schemas restrict `date_range` to
// this exact enum, so there's nothing to parse from free text; an
// unsupported phrase is a tool-schema violation the model self-corrects
// on, not something this file has to guess at.
import { nowInTimezone } from '@/lib/automations/timezone'

export const DATE_RANGE_OPTIONS = [
  'today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month',
  'last_monday', 'last_tuesday', 'last_wednesday', 'last_thursday', 'last_friday', 'last_saturday', 'last_sunday',
] as const
export type DateRangeOption = typeof DATE_RANGE_OPTIONS[number]

const WEEKDAY_INDEX: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }

function toLocalMidnightUtcIso(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`
}
function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Returns { label, start, end } where start/end are ISO timestamps
// covering [start, end) in business-local wall-clock terms — good enough
// resolution for day/week/month bucketing without pulling in a timezone
// library; the same tradeoff Phase B/D's date bucketing already makes,
// documented there and here rather than silently assumed perfect.
// For DATE-only columns (Phase G's orders.service_date), not TIMESTAMP
// columns (Phase E's orders.created_at). resolveDateRange()'s `end` is
// exclusive ("today" means [midnight today, midnight tomorrow)) — for an
// inclusive plain-date range that means subtracting a day. Using
// resolveDateRange()'s raw end directly against a DATE column with a
// `<=` comparison would silently include one extra day (found and fixed
// during Phase G — see routes.ts).
export function resolveInclusiveDateRange(option: DateRangeOption, timezone: string): { label: string; startDate: string; endDate: string } {
  const { label, start, end } = resolveDateRange(option, timezone)
  const startDate = start.slice(0, 10)
  const endDate = addDays(end.slice(0, 10), -1)
  return { label, startDate, endDate }
}

export function resolveDateRange(option: DateRangeOption, timezone: string): { label: string; start: string; end: string } {
  const today = nowInTimezone(timezone).date // 'YYYY-MM-DD' in business-local terms

  switch (option) {
    case 'today':
      return { label: 'today', start: toLocalMidnightUtcIso(today), end: toLocalMidnightUtcIso(addDays(today, 1)) }
    case 'yesterday': {
      const y = addDays(today, -1)
      return { label: 'yesterday', start: toLocalMidnightUtcIso(y), end: toLocalMidnightUtcIso(today) }
    }
    case 'this_week': {
      const dow = new Date(`${today}T00:00:00Z`).getUTCDay() // 0=Sun
      const mondayOffset = dow === 0 ? -6 : 1 - dow
      const start = addDays(today, mondayOffset)
      return { label: 'this week', start: toLocalMidnightUtcIso(start), end: toLocalMidnightUtcIso(addDays(today, 1)) }
    }
    case 'last_week': {
      const dow = new Date(`${today}T00:00:00Z`).getUTCDay()
      const mondayOffset = dow === 0 ? -6 : 1 - dow
      const thisMonday = addDays(today, mondayOffset)
      const lastMonday = addDays(thisMonday, -7)
      return { label: 'last week', start: toLocalMidnightUtcIso(lastMonday), end: toLocalMidnightUtcIso(thisMonday) }
    }
    case 'this_month': {
      const start = `${today.slice(0, 7)}-01`
      return { label: 'this month', start: toLocalMidnightUtcIso(start), end: toLocalMidnightUtcIso(addDays(today, 1)) }
    }
    case 'last_month': {
      const [y, m] = today.split('-').map(Number)
      const lastMonth = new Date(Date.UTC(y, m - 2, 1))
      const start = lastMonth.toISOString().slice(0, 10)
      const end = `${today.slice(0, 7)}-01`
      return { label: 'last month', start: toLocalMidnightUtcIso(start), end: toLocalMidnightUtcIso(end) }
    }
    default: {
      // last_<weekday>
      const weekdayName = option.replace('last_', '')
      const targetDow = WEEKDAY_INDEX[weekdayName]
      const todayDow = new Date(`${today}T00:00:00Z`).getUTCDay()
      let diff = todayDow - targetDow
      if (diff <= 0) diff += 7
      const date = addDays(today, -diff)
      return { label: `last ${weekdayName[0].toUpperCase()}${weekdayName.slice(1)}`, start: toLocalMidnightUtcIso(date), end: toLocalMidnightUtcIso(addDays(date, 1)) }
    }
  }
}
