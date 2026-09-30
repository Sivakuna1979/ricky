/**
 * Two-stage discounted cash flow model. Pure functions — used by the server
 * (default scenarios) and the interactive client calculator alike.
 *
 * Stage 1 (years 1–5): cash flow grows at the stage-1 rate.
 * Stage 2 (years 6–10): growth fades linearly from the stage-1 rate to the terminal rate.
 * Terminal value: Gordon growth on year-10 cash flow.
 *
 * Two driver methods:
 *  • 'fcf'     — start from current free cash flow and grow it.
 *  • 'revenue' — project revenue, apply operating margin, tax, and an FCF
 *                conversion ratio (FCF ÷ NOPAT) to derive free cash flow.
 */
export type DcfMethod = 'fcf' | 'revenue'

export interface DcfInputs {
  method: DcfMethod
  currentFcf: number
  fcfGrowth: number // % per year, stage 1
  currentRevenue: number
  revenueGrowth: number // % per year, stage 1
  operatingMargin: number // %
  taxRate: number // %
  fcfConversion: number // FCF ÷ NOPAT, %
  wacc: number // %
  terminalGrowth: number // %
  netDebt: number
  shares: number
}

export interface DcfYear {
  year: number
  growth: number
  revenue: number | null
  fcf: number
  discountFactor: number
  presentValue: number
}

export interface DcfResult {
  valid: boolean
  error?: string
  years: DcfYear[]
  pvCashFlows: number
  terminalValue: number
  pvTerminal: number
  enterpriseValue: number
  equityValue: number
  perShare: number
  terminalShareOfValue: number // %
}

export function runDcf(i: DcfInputs): DcfResult {
  const empty: DcfResult = { valid: false, years: [], pvCashFlows: 0, terminalValue: 0, pvTerminal: 0, enterpriseValue: 0, equityValue: 0, perShare: 0, terminalShareOfValue: 0 }
  if (i.wacc <= i.terminalGrowth) return { ...empty, error: 'WACC must be greater than terminal growth.' }
  if (i.shares <= 0) return { ...empty, error: 'Shares outstanding must be positive.' }
  if (i.wacc <= 0 || i.wacc > 30) return { ...empty, error: 'WACC should be between 0% and 30%.' }

  const g1 = (i.method === 'fcf' ? i.fcfGrowth : i.revenueGrowth) / 100
  const gT = i.terminalGrowth / 100
  const r = i.wacc / 100
  const years: DcfYear[] = []
  let fcf = i.currentFcf
  let revenue = i.currentRevenue
  let pv = 0
  for (let t = 1; t <= 10; t++) {
    const g = t <= 5 ? g1 : g1 + ((gT - g1) * (t - 5)) / 5
    let rev: number | null = null
    if (i.method === 'fcf') {
      fcf = fcf * (1 + g)
    } else {
      revenue = revenue * (1 + g)
      rev = revenue
      fcf = revenue * (i.operatingMargin / 100) * (1 - i.taxRate / 100) * (i.fcfConversion / 100)
    }
    const df = 1 / Math.pow(1 + r, t)
    pv += fcf * df
    years.push({ year: t, growth: g * 100, revenue: rev, fcf, discountFactor: df, presentValue: fcf * df })
  }
  const terminalValue = (fcf * (1 + gT)) / (r - gT)
  const pvTerminal = terminalValue / Math.pow(1 + r, 10)
  const enterpriseValue = pv + pvTerminal
  const equityValue = enterpriseValue - i.netDebt
  return {
    valid: true,
    years,
    pvCashFlows: pv,
    terminalValue,
    pvTerminal,
    enterpriseValue,
    equityValue,
    perShare: equityValue / i.shares,
    terminalShareOfValue: (pvTerminal / enterpriseValue) * 100,
  }
}

export function marginOfSafety(fairValue: number, price: number): number {
  return ((fairValue - price) / fairValue) * 100
}

/** Reverse DCF: the stage-1 growth the current price implies (bisection). */
export function impliedGrowth(base: DcfInputs, price: number): number | null {
  let lo = -20
  let hi = 60
  const at = (g: number) => runDcf({ ...base, fcfGrowth: g, revenueGrowth: g }).perShare
  if (!Number.isFinite(at(lo)) || !Number.isFinite(at(hi))) return null
  if (at(hi) < price || at(lo) > price) return null
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2
    if (at(mid) < price) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
