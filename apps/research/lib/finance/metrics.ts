import type { AnnualFinancials, CompanyDataset, Num } from '@/lib/domain/types'
import { cagr, div, growth, isNum, mean, pct, stdev, sumLoose } from './stats'

/**
 * Deterministic per-year metrics. Formulas (documented in docs/SCORING_METHODOLOGY.md):
 *  ROIC = EBIT × (1 − effective tax rate) ÷ (total debt + equity − cash − short-term investments)
 *  ROE  = net income ÷ average shareholders' equity
 *  ROA  = net income ÷ average total assets
 *  FCF  = operating cash flow − capital expenditure
 */
export interface YearMetrics {
  fiscalYear: number
  revenue: Num
  grossMargin: Num
  operatingMargin: Num
  netMargin: Num
  fcf: Num
  fcfMargin: Num
  fcfPerShare: Num
  roe: Num
  roa: Num
  roic: Num
  taxRate: Num
  investedCapital: Num
  currentRatio: Num
  quickRatio: Num
  debtToEquity: Num
  netDebt: Num
  netDebtToEbitda: Num
  debtToEbitda: Num
  interestCoverage: Num
  fcfConversion: Num // FCF / net income, %
  ocfToNetIncome: Num // ratio
  capexToRevenue: Num
  rndToRevenue: Num
  sbcToRevenue: Num
  sbcToFcf: Num
  revenueGrowth: Num
  epsGrowth: Num
  fcfGrowth: Num
  operatingIncomeGrowth: Num
  netIncomeGrowth: Num
  ocfGrowth: Num
  dividendGrowth: Num
  sharesChange: Num
  payoutRatio: Num
  fcfPayoutRatio: Num
  shareholderYieldOfFcf: Num // (dividends + buybacks) / FCF, %
  goodwillToAssets: Num
  // historical multiples at fiscal year-end price
  pe: Num
  ps: Num
  pb: Num
  pfcf: Num
  evToEbitda: Num
  evToEbit: Num
  evToSales: Num
  dividendYield: Num
}

export interface GrowthSet {
  y1: Num
  y3: Num
  y5: Num
  y10: Num
}

export type GrowthTrend = 'accelerating' | 'stable' | 'slowing' | 'declining' | 'unknown'

export interface FinancialProfile {
  years: YearMetrics[]
  latest: YearMetrics
  previous: YearMetrics | null
  avg5: Partial<Record<keyof YearMetrics, Num>>
  avg10: Partial<Record<keyof YearMetrics, Num>>
  growth: {
    revenue: GrowthSet
    eps: GrowthSet
    fcf: GrowthSet
    operatingIncome: GrowthSet
    dividend: GrowthSet
  }
  revenueTrend: GrowthTrend
  epsTrend: GrowthTrend
  /** Years (out of available) with ROIC ≥ 15%. */
  roicAbove15Years: number
  netIncomeDownYears: number
  revenueDownYears: number
  grossMarginStdev: Num
  latestAnnual: AnnualFinancials
}

function yearMetrics(y: AnnualFinancials, prev: AnnualFinancials | undefined): YearMetrics {
  const cashLike = sumLoose(y.cash, y.shortTermInvestments)
  const taxRate = isNum(y.incomeTax) && isNum(y.pretaxIncome) && y.pretaxIncome > 0 ? Math.min(Math.max(y.incomeTax / y.pretaxIncome, 0), 0.5) : null
  const nopat = isNum(y.operatingIncome) && taxRate !== null ? y.operatingIncome * (1 - taxRate) : null
  const investedCapital = isNum(y.totalDebt) && isNum(y.equity) ? y.totalDebt + y.equity - (cashLike ?? 0) : null
  const avgEquity = prev && isNum(prev.equity) && isNum(y.equity) ? (prev.equity + y.equity) / 2 : y.equity
  const avgAssets = prev && isNum(prev.totalAssets) && isNum(y.totalAssets) ? (prev.totalAssets + y.totalAssets) / 2 : y.totalAssets
  const netDebt = isNum(y.totalDebt) && cashLike !== null ? y.totalDebt - cashLike : null
  const quickAssets = sumLoose(y.cash, y.shortTermInvestments, y.receivables)
  const px = y.fiscalYearEndPrice
  const mcap = isNum(px) && isNum(y.sharesDiluted) ? px * y.sharesDiluted : null
  const ev = mcap !== null && netDebt !== null ? mcap + netDebt : null
  const fcf = y.freeCashFlow
  const shareholderReturns = sumLoose(y.dividendsPaid, y.buybacks)

  return {
    fiscalYear: y.fiscalYear,
    revenue: y.revenue,
    grossMargin: pct(y.grossProfit, y.revenue),
    operatingMargin: pct(y.operatingIncome, y.revenue),
    netMargin: pct(y.netIncome, y.revenue),
    fcf,
    fcfMargin: pct(fcf, y.revenue),
    fcfPerShare: div(fcf, y.sharesDiluted),
    roe: isNum(avgEquity) && avgEquity > 0 ? pct(y.netIncome, avgEquity) : null,
    roa: pct(y.netIncome, avgAssets),
    roic: investedCapital !== null && investedCapital > 0 ? pct(nopat, investedCapital) : null,
    taxRate: taxRate === null ? null : taxRate * 100,
    investedCapital,
    currentRatio: div(y.currentAssets, y.currentLiabilities),
    quickRatio: div(quickAssets, y.currentLiabilities),
    debtToEquity: isNum(y.equity) && y.equity > 0 ? div(y.totalDebt, y.equity) : null,
    netDebt,
    netDebtToEbitda: div(netDebt, y.ebitda),
    debtToEbitda: div(y.totalDebt, y.ebitda),
    interestCoverage: isNum(y.interestExpense) && y.interestExpense > 0 ? div(y.operatingIncome, y.interestExpense) : null,
    fcfConversion: isNum(y.netIncome) && y.netIncome > 0 ? pct(fcf, y.netIncome) : null,
    ocfToNetIncome: isNum(y.netIncome) && y.netIncome > 0 ? div(y.operatingCashFlow, y.netIncome) : null,
    capexToRevenue: pct(y.capex, y.revenue),
    rndToRevenue: pct(y.researchAndDevelopment, y.revenue),
    sbcToRevenue: pct(y.stockBasedCompensation, y.revenue),
    sbcToFcf: isNum(fcf) && fcf > 0 ? pct(y.stockBasedCompensation, fcf) : null,
    revenueGrowth: growth(prev?.revenue, y.revenue),
    epsGrowth: growth(prev?.epsDiluted, y.epsDiluted),
    fcfGrowth: growth(prev?.freeCashFlow, fcf),
    operatingIncomeGrowth: growth(prev?.operatingIncome, y.operatingIncome),
    netIncomeGrowth: growth(prev?.netIncome, y.netIncome),
    ocfGrowth: growth(prev?.operatingCashFlow, y.operatingCashFlow),
    dividendGrowth: growth(prev?.dividendPerShare, y.dividendPerShare),
    sharesChange: growth(prev?.sharesDiluted, y.sharesDiluted),
    payoutRatio: isNum(y.netIncome) && y.netIncome > 0 ? pct(y.dividendsPaid, y.netIncome) : null,
    fcfPayoutRatio: isNum(fcf) && fcf > 0 ? pct(y.dividendsPaid, fcf) : null,
    shareholderYieldOfFcf: isNum(fcf) && fcf > 0 ? pct(shareholderReturns, fcf) : null,
    goodwillToAssets: pct(sumLoose(y.goodwill, y.intangibles), y.totalAssets),
    pe: isNum(y.epsDiluted) && y.epsDiluted > 0 ? div(px, y.epsDiluted) : null,
    ps: div(mcap, y.revenue),
    pb: isNum(y.equity) && y.equity > 0 ? div(mcap, y.equity) : null,
    pfcf: isNum(fcf) && fcf > 0 ? div(mcap, fcf) : null,
    evToEbitda: isNum(y.ebitda) && y.ebitda > 0 ? div(ev, y.ebitda) : null,
    evToEbit: isNum(y.operatingIncome) && y.operatingIncome > 0 ? div(ev, y.operatingIncome) : null,
    evToSales: div(ev, y.revenue),
    dividendYield: pct(y.dividendPerShare, px),
  }
}

function growthSet(annual: AnnualFinancials[], pick: (y: AnnualFinancials) => Num): GrowthSet {
  const n = annual.length
  const at = (back: number) => (n - 1 - back >= 0 ? pick(annual[n - 1 - back]) : null)
  const end = at(0)
  return { y1: cagr(at(1), end, 1), y3: cagr(at(3), end, 3), y5: cagr(at(5), end, 5), y10: cagr(at(10), end, 10) }
}

export function classifyTrend(g: GrowthSet): GrowthTrend {
  if (!isNum(g.y1) && !isNum(g.y3)) return 'unknown'
  const y1 = g.y1 ?? 0
  const base = g.y3 ?? g.y5 ?? y1
  if (y1 < 0 && base < 0) return 'declining'
  if (y1 > base + 2) return 'accelerating'
  if (y1 < base - 2) return y1 < 0 ? 'declining' : 'slowing'
  return 'stable'
}

const AVG_KEYS: (keyof YearMetrics)[] = [
  'grossMargin', 'operatingMargin', 'netMargin', 'fcfMargin', 'roe', 'roa', 'roic', 'currentRatio', 'quickRatio', 'debtToEquity',
  'revenueGrowth', 'epsGrowth', 'fcfGrowth', 'pe', 'ps', 'pb', 'pfcf', 'evToEbitda', 'evToEbit', 'evToSales', 'dividendYield',
  'fcfConversion', 'sbcToRevenue', 'rndToRevenue', 'interestCoverage', 'debtToEbitda', 'payoutRatio',
]

export function computeFinancialProfile(ds: CompanyDataset): FinancialProfile | null {
  const annual = ds.annual
  if (!annual.length) return null
  const years = annual.map((y, i) => yearMetrics(y, annual[i - 1]))
  const avg = (n: number) => Object.fromEntries(AVG_KEYS.map((k) => [k, mean(years.slice(-n).map((y) => y[k] as Num))]))
  const g = {
    revenue: growthSet(annual, (y) => y.revenue),
    eps: growthSet(annual, (y) => y.epsDiluted),
    fcf: growthSet(annual, (y) => y.freeCashFlow),
    operatingIncome: growthSet(annual, (y) => y.operatingIncome),
    dividend: growthSet(annual, (y) => y.dividendPerShare),
  }
  return {
    years,
    latest: years[years.length - 1],
    previous: years.length > 1 ? years[years.length - 2] : null,
    avg5: avg(5),
    avg10: avg(10),
    growth: g,
    revenueTrend: classifyTrend(g.revenue),
    epsTrend: classifyTrend(g.eps),
    roicAbove15Years: years.filter((y) => isNum(y.roic) && y.roic >= 15).length,
    netIncomeDownYears: years.filter((y) => isNum(y.netIncomeGrowth) && y.netIncomeGrowth < 0).length,
    revenueDownYears: years.filter((y) => isNum(y.revenueGrowth) && y.revenueGrowth < 0).length,
    grossMarginStdev: stdev(years.map((y) => y.grossMargin)),
    latestAnnual: annual[annual.length - 1],
  }
}

/** Share count history with annualised change rates. */
export function dilutionProfile(annual: AnnualFinancials[]) {
  const n = annual.length
  const shares = (back: number) => (n - 1 - back >= 0 ? annual[n - 1 - back].sharesDiluted : null)
  const now = shares(0)
  return {
    now,
    y1: shares(1),
    y5: shares(5),
    y10: shares(10),
    rate1: cagr(shares(1), now, 1),
    rate5: cagr(shares(5), now, 5),
    rate10: cagr(shares(10), now, 10),
  }
}
