import type { Num } from '@/lib/domain/types'

export const NA = 'Data unavailable'

const SYMBOLS: Record<string, string> = { USD: '$', GBP: '£', EUR: '€', JPY: '¥', CNY: '¥', CAD: 'C$', AUD: 'A$', CHF: 'CHF ', INR: '₹', BRL: 'R$' }
export const currencySymbol = (ccy = 'USD') => SYMBOLS[ccy] ?? `${ccy} `

const ok = (v: Num | undefined): v is number => typeof v === 'number' && Number.isFinite(v)

export function fmtMoney(v: Num | undefined, ccy = 'USD', digits = 1): string {
  if (!ok(v)) return NA
  const s = currencySymbol(ccy)
  const a = Math.abs(v)
  const sign = v < 0 ? '−' : ''
  if (a >= 1e12) return `${sign}${s}${(a / 1e12).toFixed(2)}T`
  if (a >= 1e9) return `${sign}${s}${(a / 1e9).toFixed(digits)}B`
  if (a >= 1e6) return `${sign}${s}${(a / 1e6).toFixed(digits)}M`
  if (a >= 1e3) return `${sign}${s}${(a / 1e3).toFixed(digits)}K`
  return `${sign}${s}${a.toFixed(2)}`
}

export function fmtPrice(v: Num | undefined, ccy = 'USD'): string {
  if (!ok(v)) return NA
  const sign = v < 0 ? '−' : ''
  return `${sign}${currencySymbol(ccy)}${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtPct(v: Num | undefined, digits = 1, signed = false): string {
  if (!ok(v)) return NA
  const s = signed && v > 0 ? '+' : ''
  return `${s}${v.toFixed(digits)}%`
}

export function fmtX(v: Num | undefined, digits = 1): string {
  if (!ok(v)) return NA
  return `${v.toFixed(digits)}×`
}

export function fmtNum(v: Num | undefined, digits = 2): string {
  if (!ok(v)) return NA
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function fmtShares(v: Num | undefined): string {
  if (!ok(v)) return NA
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  return v.toLocaleString('en-US')
}

export function fmtDate(iso: string | undefined): string {
  if (!iso) return NA
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00Z' : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
