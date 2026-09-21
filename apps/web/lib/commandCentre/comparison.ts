// @ts-nocheck
// K9-K11 — the one deterministic comparison engine every Command Centre
// KPI/trend/exception uses. Nothing here calls an LLM; date-string
// arithmetic (never raw millisecond diffs across a local-time boundary)
// keeps this DST-safe by construction, the same trick already used by
// lib/ai/dateRange.ts.
import { round2 } from '@/lib/finance/money'
import { nowInTimezone } from '@/lib/automations/timezone'

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function isoStart(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`
}

// K63 — factual, never an invented confidence percentage: the label is
// derived purely from how many genuinely comparable data points existed.
export type Coverage = 'HIGH DATA COVERAGE' | 'LIMITED DATA' | 'INSUFFICIENT DATA'
export function coverageForSampleSize(n: number): Coverage {
  if (n >= 3) return 'HIGH DATA COVERAGE'
  if (n >= 1) return 'LIMITED DATA'
  return 'INSUFFICIENT DATA'
}

export type Comparison = {
  current: number
  prior: number | null
  delta: number | null
  delta_pct: number | null
  coverage: Coverage
  note: string
}

// K10/K11 — never a meaningless infinity percentage. Zero-prior and
// missing-history are both explicit, labelled states, not silently
// coerced into a number.
export function compareValues(current: number, prior: number | null, comparablePeriods = prior == null ? 0 : 1): Comparison {
  const cur = round2(current ?? 0)
  if (prior == null) {
    return { current: cur, prior: null, delta: null, delta_pct: null, coverage: 'INSUFFICIENT DATA', note: 'No comparable prior period found.' }
  }
  const p = round2(prior)
  const delta = round2(cur - p)
  let delta_pct: number | null = null
  let note = ''
  if (p === 0) {
    note = cur === 0 ? 'Both periods are zero.' : 'Prior period was zero — a percentage change would not be meaningful.'
  } else {
    delta_pct = round2((delta / p) * 100)
  }
  return { current: cur, prior: p, delta, delta_pct, coverage: coverageForSampleSize(comparablePeriods), note }
}

// K9 — "today vs comparable day". A comparable day is the same weekday in
// a prior week that this business actually traded (K11: "trading day vs
// trading day"), never just "7 days ago" blindly. Walks back up to 4 weeks
// looking for trading days, so a business that's only been open 2 Fridays
// gets an honest "2 comparable Fridays" (K63) rather than a fabricated
// full history.
export async function findComparableTradingDays(
  admin: any, businessId: string, vanIds: string[], targetDate: string, opts: { maxWeeksBack?: number; maxResults?: number } = {}
): Promise<string[]> {
  const maxWeeksBack = opts.maxWeeksBack ?? 8
  const maxResults = opts.maxResults ?? 4
  if (!vanIds.length) return []

  const dow = new Date(`${targetDate}T00:00:00Z`).getUTCDay() // native JS 0=Sun..6=Sat
  const scheduleDow = (dow + 6) % 7 // van_schedule's own 0=Mon..6=Sun convention
  const { data: scheduleRows } = await admin.from('van_schedule').select('van_id').in('van_id', vanIds).eq('day_of_week', scheduleDow)
  const scheduledVans = new Set((scheduleRows ?? []).map((r: any) => r.van_id))
  const hasAnySchedule = scheduledVans.size > 0

  const candidates: string[] = []
  for (let w = 1; w <= maxWeeksBack && candidates.length < maxResults; w++) {
    candidates.push(addDays(targetDate, -7 * w))
  }

  const results: string[] = []
  for (const date of candidates) {
    if (hasAnySchedule) {
      // A business with a known schedule: a "trading day" is one the
      // schedule says this business operates on — deterministic, never
      // inferred from whether sales happened to occur.
      results.push(date)
    } else {
      // No fixed schedule at all (fully ad-hoc/live-only business) — the
      // only honest signal left is whether an order actually exists.
      const { count } = await admin.from('orders').select('id', { count: 'exact', head: true })
        .in('van_id', vanIds).gte('created_at', isoStart(date)).lt('created_at', isoStart(addDays(date, 1)))
      if ((count ?? 0) > 0) results.push(date)
    }
    if (results.length >= maxResults) break
  }
  return results
}

// K11 — "partial day vs same time": when comparing an in-progress today
// against a comparable day, the comparable day's figure is cut off at the
// same wall-clock time, not its full-day total, or an in-progress trading
// session would always look artificially down.
export function partialDayWindow(dateStr: string, hour: number, minute: number): { start: string; end: string } {
  const cutoff = new Date(`${dateStr}T00:00:00Z`)
  cutoff.setUTCHours(hour, minute, 0, 0)
  return { start: isoStart(dateStr), end: cutoff.toISOString() }
}

// The high-level entry point most callers want: "compare a live metric
// (computed by `metricFn`) for today against its comparable-day baseline",
// handling partial-day cutoff and multi-week averaging automatically.
// `metricFn(startIso, endIso)` must return a plain number (e.g. revenue,
// order count) — the caller owns what the metric actually means.
export async function compareTodayToComparableDays(
  admin: any, businessId: string, vanIds: string[], timezone: string,
  metricFn: (startIso: string, endIso: string) => Promise<number>
): Promise<Comparison & { comparable_dates: string[] }> {
  const { date: today, hour, minute } = nowInTimezone(timezone)
  const current = await metricFn(isoStart(today), new Date().toISOString())

  const comparableDates = await findComparableTradingDays(admin, businessId, vanIds, today)
  if (!comparableDates.length) {
    return { ...compareValues(current, null), comparable_dates: [] }
  }

  const partialValues: number[] = []
  for (const date of comparableDates) {
    const { start, end } = partialDayWindow(date, hour, minute)
    partialValues.push(await metricFn(start, end))
  }
  const avgPrior = round2(partialValues.reduce((s, v) => s + v, 0) / partialValues.length)
  return { ...compareValues(current, avgPrior, comparableDates.length), comparable_dates: comparableDates }
}

// K9 — week vs prior week / month vs prior month. Straightforward
// calendar-period comparison; "zero denominator"/"missing history" are
// still handled by compareValues() itself.
export function priorWeekRange(timezone: string): { start: string; end: string; label: string } {
  const { date: today } = nowInTimezone(timezone)
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const thisMonday = addDays(today, mondayOffset)
  const lastMonday = addDays(thisMonday, -7)
  return { start: isoStart(lastMonday), end: isoStart(thisMonday), label: 'last week' }
}

export function priorMonthRange(timezone: string): { start: string; end: string; label: string } {
  const { date: today } = nowInTimezone(timezone)
  const [y, m] = today.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10)
  const end = `${today.slice(0, 7)}-01`
  return { start: isoStart(start), end: isoStart(end), label: 'last month' }
}
