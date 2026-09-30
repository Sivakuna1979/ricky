import type { Num } from '@/lib/domain/types'

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** a / b, or null when either side is missing or b is zero. */
export function div(a: Num | undefined, b: Num | undefined): Num {
  if (!isNum(a) || !isNum(b) || b === 0) return null
  return a / b
}

export function pct(a: Num | undefined, b: Num | undefined): Num {
  const r = div(a, b)
  return r === null ? null : r * 100
}

export function sum(...vals: (Num | undefined)[]): Num {
  if (vals.some((v) => !isNum(v))) return null
  return (vals as number[]).reduce((s, v) => s + v, 0)
}

/** Treat missing components as 0 but return null if all are missing. */
export function sumLoose(...vals: (Num | undefined)[]): Num {
  const present = vals.filter(isNum)
  return present.length ? present.reduce((s, v) => s + v, 0) : null
}

export function mean(vals: Num[]): Num {
  const v = vals.filter(isNum)
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
}

export function median(vals: Num[]): Num {
  const v = vals.filter(isNum).sort((a, b) => a - b)
  if (!v.length) return null
  const m = Math.floor(v.length / 2)
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2
}

export function stdev(vals: Num[]): Num {
  const v = vals.filter(isNum)
  if (v.length < 2) return null
  const m = v.reduce((s, x) => s + x, 0) / v.length
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1))
}

/** Growth from a to b in %. Null when a ≤ 0 (growth from a negative base is meaningless). */
export function growth(prev: Num | undefined, curr: Num | undefined): Num {
  if (!isNum(prev) || !isNum(curr) || prev <= 0) return null
  return (curr / prev - 1) * 100
}

/** Compound annual growth rate in %, over `years`. Null for non-positive endpoints. */
export function cagr(start: Num | undefined, end: Num | undefined, years: number): Num {
  if (!isNum(start) || !isNum(end) || start <= 0 || end <= 0 || years <= 0) return null
  return (Math.pow(end / start, 1 / years) - 1) * 100
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Linear interpolation of a score between breakpoints. xs ascending. */
export function interpolate(x: number, xs: number[], ys: number[]): number {
  if (x <= xs[0]) return ys[0]
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1]
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1])
      return ys[i - 1] + t * (ys[i] - ys[i - 1])
    }
  }
  return ys[ys.length - 1]
}
