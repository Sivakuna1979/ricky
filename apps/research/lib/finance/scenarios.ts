/**
 * Scenario modelling (bear / base / bull). Each scenario is a set of explicit
 * assumptions; outputs follow mechanically. These are NOT forecasts.
 */
export interface ScenarioAssumptions {
  name: 'Bear' | 'Base' | 'Bull'
  revenueCagr: number // %
  operatingMargin: number // %
  taxRate: number // %
  shareChangePerYear: number // % (negative = buybacks)
  fcfMargin: number // %
  exitPeLow: number
  exitPeHigh: number
  narrative: string[]
}

export interface ScenarioResult extends ScenarioAssumptions {
  years: number
  revenue: number
  netIncome: number
  eps: number
  fcf: number
  valueLow: number
  valueHigh: number
  impliedAnnualReturnLow: number | null
  impliedAnnualReturnHigh: number | null
}

export function runScenario(
  a: ScenarioAssumptions,
  base: { revenue: number; shares: number; price: number; nonOperatingPct?: number },
  years = 5,
): ScenarioResult {
  const revenue = base.revenue * Math.pow(1 + a.revenueCagr / 100, years)
  const netIncome = revenue * (a.operatingMargin / 100) * (1 - a.taxRate / 100)
  const shares = base.shares * Math.pow(1 + a.shareChangePerYear / 100, years)
  const eps = netIncome / shares
  const fcf = revenue * (a.fcfMargin / 100)
  const valueLow = eps * a.exitPeLow
  const valueHigh = eps * a.exitPeHigh
  const ann = (v: number) => (base.price > 0 && v > 0 ? (Math.pow(v / base.price, 1 / years) - 1) * 100 : null)
  return { ...a, years, revenue, netIncome, eps, fcf, valueLow, valueHigh, impliedAnnualReturnLow: ann(valueLow), impliedAnnualReturnHigh: ann(valueHigh) }
}

export function compound(principal: number, ratePct: number, years: number, monthlyContribution = 0): number {
  const r = ratePct / 100
  const fv = principal * Math.pow(1 + r, years)
  if (!monthlyContribution) return fv
  const m = Math.pow(1 + r, 1 / 12) - 1
  const n = years * 12
  return fv + (m === 0 ? monthlyContribution * n : monthlyContribution * ((Math.pow(1 + m, n) - 1) / m))
}
