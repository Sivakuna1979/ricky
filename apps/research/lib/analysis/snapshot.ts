import type { CompanySnapshot } from '@/lib/domain/types'
import type { CompanyAnalysis } from './build'

/** Compact row for tables/screens, derived from a full analysis. */
export function toSnapshot(a: CompanyAnalysis): CompanySnapshot {
  const ds = a.dataset
  const L = a.fp.latestAnnual
  return {
    ticker: ds.profile.ticker,
    name: ds.profile.name,
    sector: ds.profile.sector,
    industry: ds.profile.industry,
    exchange: ds.profile.exchange,
    country: ds.profile.country,
    marketCap: a.valuation.marketCap,
    revenue: L.revenue,
    revenueGrowth: a.fp.latest.revenueGrowth,
    pe: a.valuation.pe,
    forwardPe: a.valuation.forwardPe,
    operatingMargin: a.fp.latest.operatingMargin,
    netMargin: a.fp.latest.netMargin,
    roe: a.fp.latest.roe,
    roic: a.fp.latest.roic,
    totalDebt: L.totalDebt,
    netDebt: a.valuation.netDebt,
    fcf: L.freeCashFlow,
    fcfGrowth: a.fp.latest.fcfGrowth,
    fcfYield: a.valuation.fcfYield,
    evToEbitda: a.valuation.evToEbitda,
    dividendYield: a.valuation.dividendYield,
    price: a.valuation.price,
    epsGrowth: a.fp.latest.epsGrowth,
    peg: a.valuation.peg,
    ps: a.valuation.ps,
    grossMargin: a.fp.latest.grossMargin,
    debtToEquity: a.fp.latest.debtToEquity,
    sourceId: L.sourceId,
  }
}
