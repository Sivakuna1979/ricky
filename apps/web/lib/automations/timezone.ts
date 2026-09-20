// @ts-nocheck
// Timezone-aware scheduling helpers (D28) — everything here uses the
// business's own `businesses.timezone` (defaults to 'Europe/London' for
// every existing UK business) rather than assuming UTC.

// Returns the wall-clock date/time the business would see right now, e.g.
// { date: '2026-09-20', hour: 8, minute: 5, weekday: 'Sun' }.
export function nowInTimezone(timezone: string) {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  }).formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)?.value
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    weekday: get('weekday'), // 'Mon'..'Sun'
  }
}

export function todayDateInTimezone(timezone: string): string {
  return nowInTimezone(timezone).date
}

// True if business-local time is within `windowMinutes` after the target
// hour:minute — used so an hourly-or-so cron tick can reliably catch a
// "run at 08:00" automation without needing a job scheduled at the exact
// minute. Deliberately does not fire before the target time.
export function isDueNow(timezone: string, targetHour: number, targetMinute: number, windowMinutes = 65): boolean {
  const { hour, minute } = nowInTimezone(timezone)
  const nowMinutes = hour * 60 + minute
  const targetMinutes = targetHour * 60 + targetMinute
  return nowMinutes >= targetMinutes && nowMinutes < targetMinutes + windowMinutes
}

const ISO_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export function isWeekday(timezone: string, weekday: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'): boolean {
  return nowInTimezone(timezone).weekday === weekday
}

// ISO week label (e.g. '2026-W38') for weekly_summary's dedup key —
// timezone-aware so the week boundary matches the business's own calendar,
// not UTC's.
export function isoWeekKey(timezone: string): string {
  const { date } = nowInTimezone(timezone)
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d as any) - (yearStart as any)) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}
