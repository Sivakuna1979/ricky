// Minimal cron helper, kept dependency-free and side-effect-free so it can be
// unit tested in isolation. Supports the common 5-field form (m h dom mon dow)
// with '*', lists (a,b), ranges (a-b) and steps (*/n). Returns the next fire
// time after `from`, or null if none within a one-year horizon / on bad input.
export function nextCronRun(expr: string, from = new Date()): Date | null {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [min, hour, dom, mon, dow] = parts

  const match = (field: string, value: number, lo: number): boolean => {
    if (field === '*') return true
    for (const token of field.split(',')) {
      if (token.includes('/')) {
        const [, stepStr] = token.split('/')
        const step = parseInt(stepStr, 10)
        if (step > 0 && (value - lo) % step === 0) return true
      } else if (token.includes('-')) {
        const [a, b] = token.split('-').map((n) => parseInt(n, 10))
        if (value >= a && value <= b) return true
      } else if (parseInt(token, 10) === value) {
        return true
      }
    }
    return false
  }

  const cursor = new Date(from.getTime() + 60_000 - (from.getTime() % 60_000))
  const horizon = new Date(from.getTime() + 366 * 24 * 60 * 60 * 1000)
  while (cursor < horizon) {
    if (
      match(min, cursor.getMinutes(), 0) &&
      match(hour, cursor.getHours(), 0) &&
      match(dom, cursor.getDate(), 1) &&
      match(mon, cursor.getMonth() + 1, 1) &&
      match(dow, cursor.getDay(), 0)
    ) {
      return new Date(cursor)
    }
    cursor.setMinutes(cursor.getMinutes() + 1)
  }
  return null
}
