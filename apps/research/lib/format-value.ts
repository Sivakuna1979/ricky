/** Compact number formatting shared by server and client components. */
export type ValueFormat = 'money' | 'pct' | 'num' | 'price' | 'shares'

export function formatValue(v: number | null | undefined, f: ValueFormat, sym = '$'): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  const sign = v < 0 ? '−' : ''
  switch (f) {
    case 'money':
      if (a >= 1e12) return `${sign}${sym}${(a / 1e12).toFixed(2)}T`
      if (a >= 1e9) return `${sign}${sym}${(a / 1e9).toFixed(1)}B`
      if (a >= 1e6) return `${sign}${sym}${(a / 1e6).toFixed(0)}M`
      return `${sign}${sym}${a.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    case 'shares':
      return a >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : `${(v / 1e6).toFixed(0)}M`
    case 'pct':
      return `${v.toFixed(1)}%`
    case 'price':
      return `${sym}${v.toFixed(2)}`
    default:
      return v.toFixed(2)
  }
}

