import type { CompanyDataset, Num } from '@/lib/domain/types'
import type { FinancialProfile } from './metrics'
import { div, isNum, median, pct, sumLoose } from './stats'

export interface CurrentValuation {
  price: Num
  marketCap: Num
  enterpriseValue: Num
  netDebt: Num
  shares: Num
  pe: Num
  forwardPe: Num
  peg: Num
  pegGrowthBasis: string
  ps: Num
  pb: Num
  evToEbitda: Num
  evToEbit: Num
  evToSales: Num
  pfcf: Num
  fcfYield: Num
  earningsYield: Num // EBIT / EV (Greenblatt)
  peEarningsYield: Num // EPS / price
  dividendYield: Num
  bookValuePerShare: Num
}

/**
 * Current multiples use the latest reported fiscal year as the denominator
 * (TTM when a provider supplies quarterly data — planned).
 */
export function computeCurrentValuation(ds: CompanyDataset, fp: FinancialProfile): CurrentValuation {
  const y = fp.latestAnnual
  const price = ds.quote.price
  const shares = isNum(ds.quote.marketCap) && isNum(price) && price > 0 ? ds.quote.marketCap / price : y.sharesDiluted
  const marketCap = ds.quote.marketCap ?? (isNum(price) && isNum(shares) ? price * shares : null)
  const cashLike = sumLoose(y.cash, y.shortTermInvestments)
  const netDebt = isNum(y.totalDebt) && cashLike !== null ? y.totalDebt - cashLike : null
  const ev = isNum(marketCap) && netDebt !== null ? marketCap + netDebt : null
  const pe = isNum(y.epsDiluted) && y.epsDiluted > 0 ? div(price, y.epsDiluted) : null
  const forwardEps = ds.estimates?.epsNextFY ?? null
  const forwardPe = isNum(forwardEps) && forwardEps > 0 ? div(price, forwardEps) : null

  // PEG: prefer consensus long-term growth; fall back to the historical 5-year EPS CAGR.
  let pegGrowth: Num = ds.estimates?.longTermEpsGrowth ?? null
  let pegGrowthBasis = 'consensus long-term EPS growth (third-party estimate)'
  if (!isNum(pegGrowth)) {
    pegGrowth = fp.growth.eps.y5
    pegGrowthBasis = 'historical 5-year EPS CAGR'
  }
  const peg = isNum(pe) && isNum(pegGrowth) && pegGrowth > 0 ? pe / pegGrowth : null

  return {
    price,
    marketCap,
    enterpriseValue: ev,
    netDebt,
    shares,
    pe,
    forwardPe,
    peg,
    pegGrowthBasis,
    ps: div(marketCap, y.revenue),
    pb: isNum(y.equity) && y.equity > 0 ? div(marketCap, y.equity) : null,
    evToEbitda: isNum(y.ebitda) && y.ebitda > 0 ? div(ev, y.ebitda) : null,
    evToEbit: isNum(y.operatingIncome) && y.operatingIncome > 0 ? div(ev, y.operatingIncome) : null,
    evToSales: div(ev, y.revenue),
    pfcf: isNum(y.freeCashFlow) && y.freeCashFlow > 0 ? div(marketCap, y.freeCashFlow) : null,
    fcfYield: pct(y.freeCashFlow, marketCap),
    earningsYield: pct(y.operatingIncome, ev),
    peEarningsYield: pct(y.epsDiluted, price),
    dividendYield: pct(y.dividendPerShare, price),
    bookValuePerShare: div(y.equity, shares),
  }
}

export type MultipleKey = 'pe' | 'forwardPe' | 'peg' | 'ps' | 'pb' | 'evToEbitda' | 'evToEbit' | 'evToSales' | 'pfcf' | 'fcfYield' | 'earningsYield' | 'dividendYield'

export interface MultipleComparison {
  key: MultipleKey
  label: string
  current: Num
  avg5: Num
  avg10: Num
  industry: Num
  peerMedian: Num
  /** Premium vs a blended reference, % (positive = more expensive). */
  premiumPct: Num
  higherIsCheaper: boolean
}

export function compareMultiples(ds: CompanyDataset, fp: FinancialProfile, v: CurrentValuation): MultipleComparison[] {
  const ind = ds.industry
  const peers = ds.peers
  const rows: { key: MultipleKey; label: string; hist?: keyof FinancialProfile['avg5']; industry?: Num; peer?: Num; higherIsCheaper?: boolean }[] = [
    { key: 'pe', label: 'P/E', hist: 'pe', industry: ind?.pe, peer: median(peers.map((p) => p.pe)) },
    { key: 'forwardPe', label: 'Forward P/E', industry: ind?.forwardPe, peer: median(peers.map((p) => p.forwardPe)) },
    { key: 'peg', label: 'PEG' },
    { key: 'ps', label: 'Price / Sales', hist: 'ps', industry: ind?.ps },
    { key: 'pb', label: 'Price / Book', hist: 'pb', industry: ind?.pb },
    { key: 'evToEbitda', label: 'EV / EBITDA', hist: 'evToEbitda', industry: ind?.evToEbitda, peer: median(peers.map((p) => p.evToEbitda)) },
    { key: 'evToEbit', label: 'EV / EBIT', hist: 'evToEbit' },
    { key: 'evToSales', label: 'EV / Sales', hist: 'evToSales' },
    { key: 'pfcf', label: 'Price / FCF', hist: 'pfcf', industry: ind?.pfcf },
    { key: 'fcfYield', label: 'FCF Yield %', industry: ind?.pfcf ? 100 / ind.pfcf : null, peer: median(peers.map((p) => p.fcfYield)), higherIsCheaper: true },
    { key: 'earningsYield', label: 'Earnings Yield (EBIT/EV) %', higherIsCheaper: true },
    { key: 'dividendYield', label: 'Dividend Yield %', hist: 'dividendYield', peer: median(peers.map((p) => p.dividendYield)), higherIsCheaper: true },
  ]
  return rows.map((r) => {
    const current = v[r.key] as Num
    const avg5 = r.hist ? fp.avg5[r.hist] ?? null : r.key === 'fcfYield' && isNum(fp.avg5.pfcf) ? 100 / fp.avg5.pfcf : null
    const avg10 = r.hist ? fp.avg10[r.hist] ?? null : r.key === 'fcfYield' && isNum(fp.avg10.pfcf) ? 100 / fp.avg10.pfcf : null
    const refs = [avg5, avg10, r.industry ?? null, r.peer ?? null].filter(isNum)
    const ref = refs.length ? refs.reduce((s, x) => s + x, 0) / refs.length : null
    let premiumPct: Num = null
    if (isNum(current) && isNum(ref) && ref > 0 && current > 0) {
      premiumPct = r.higherIsCheaper ? (ref / current - 1) * 100 : (current / ref - 1) * 100
    }
    return { key: r.key, label: r.label, current, avg5, avg10, industry: r.industry ?? null, peerMedian: r.peer ?? null, premiumPct, higherIsCheaper: Boolean(r.higherIsCheaper) }
  })
}

/** Graham Number = √(22.5 × EPS × BVPS). Null when EPS or BVPS ≤ 0. */
export function grahamNumber(eps: Num, bvps: Num): Num {
  if (!isNum(eps) || !isNum(bvps) || eps <= 0 || bvps <= 0) return null
  return Math.sqrt(22.5 * eps * bvps)
}
