import type { AnnualFinancials, CompanyProfile, EarningsQuarter, PricePoint, Quote, AnalystEstimates, SourceRef } from '@/lib/domain/types'
import { fetchJson, type DataProvider, type SearchResult } from '../types'

/**
 * Financial Modeling Prep adapter (paid tiers vary — endpoints used here may
 * require a plan that includes them). Uses the /stable API. Field names are
 * read defensively because FMP has renamed fields between API versions; any
 * field that cannot be found maps to `null` rather than a guessed value.
 */
const BASE = 'https://financialmodelingprep.com/stable'

type Rec = Record<string, unknown>

const num = (o: Rec | undefined, ...keys: string[]): number | null => {
  if (!o) return null
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return null
}
const str = (o: Rec | undefined, ...keys: string[]): string | undefined => {
  if (!o) return undefined
  for (const k of keys) if (typeof o[k] === 'string' && o[k]) return o[k] as string
  return undefined
}
const abs = (v: number | null) => (v === null ? null : Math.abs(v))

function key() {
  return process.env.FMP_API_KEY ?? ''
}

async function get<T = Rec[]>(path: string, params: Record<string, string | number>, revalidateSeconds = 3600): Promise<T> {
  const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), apikey: key() })
  return fetchJson<T>('fmp', `${BASE}/${path}?${qs}`, { revalidateSeconds })
}

export const fmpProvider: DataProvider = {
  id: 'fmp',
  name: 'Financial Modeling Prep',
  capabilities: ['search', 'profile', 'quote', 'prices', 'financials', 'estimates', 'earnings'],
  isConfigured: () => Boolean(process.env.FMP_API_KEY),
  sourceRef(ticker: string): SourceRef {
    return {
      id: 'fmp',
      name: 'Financial Modeling Prep (normalised from company filings)',
      tier: 'provider',
      url: `https://financialmodelingprep.com/financial-summary/${encodeURIComponent(ticker)}`,
      updated: new Date().toISOString().slice(0, 10),
    }
  },

  async search(query) {
    const rows = await get<Rec[]>('search-symbol', { query, limit: 10 }, 86400)
    return rows.map<SearchResult>((r) => ({
      ticker: str(r, 'symbol') ?? '',
      name: str(r, 'name') ?? '',
      exchange: str(r, 'exchange', 'exchangeShortName'),
      hasFullAnalysis: true,
    }))
  },

  async getProfile(ticker) {
    const [p] = await get<Rec[]>('profile', { symbol: ticker }, 86400)
    if (!p) return null
    const ipo = str(p, 'ipoDate')
    return {
      ticker,
      name: str(p, 'companyName') ?? ticker,
      exchange: str(p, 'exchange', 'exchangeShortName') ?? '—',
      country: str(p, 'country') ?? '—',
      currency: str(p, 'currency') ?? 'USD',
      sector: str(p, 'sector') ?? '—',
      industry: str(p, 'industry') ?? '—',
      description: str(p, 'description') ?? '',
      website: str(p, 'website'),
      cik: str(p, 'cik'),
      ipoDate: ipo,
      employees: num(p, 'fullTimeEmployees') ?? (Number(p.fullTimeEmployees) || null),
      ceo: str(p, 'ceo'),
      sourceId: 'fmp',
    } satisfies CompanyProfile
  },

  async getQuote(ticker) {
    const [q] = await get<Rec[]>('quote', { symbol: ticker }, 300)
    if (!q) return null
    return {
      price: num(q, 'price'),
      change: num(q, 'change'),
      changePct: num(q, 'changePercentage', 'changesPercentage'),
      marketCap: num(q, 'marketCap'),
      yearHigh: num(q, 'yearHigh'),
      yearLow: num(q, 'yearLow'),
      volume: num(q, 'volume'),
      avgVolume: num(q, 'avgVolume'),
      asOf: new Date().toISOString(),
      sourceId: 'fmp',
    } satisfies Quote
  },

  async getPrices(ticker, fromDate) {
    const rows = await get<Rec[]>('historical-price-eod/full', { symbol: ticker, from: fromDate }, 3600)
    return rows
      .map<PricePoint>((r) => ({ date: str(r, 'date') ?? '', close: num(r, 'adjClose', 'close') ?? NaN, volume: num(r, 'volume') ?? undefined }))
      .filter((p) => p.date && Number.isFinite(p.close))
      .sort((a, b) => a.date.localeCompare(b.date))
  },

  async getAnnualFinancials(ticker, years) {
    const [inc, bal, cf] = await Promise.all([
      get<Rec[]>('income-statement', { symbol: ticker, period: 'annual', limit: years }, 86400),
      get<Rec[]>('balance-sheet-statement', { symbol: ticker, period: 'annual', limit: years }, 86400),
      get<Rec[]>('cash-flow-statement', { symbol: ticker, period: 'annual', limit: years }, 86400),
    ])
    const byDate = (rows: Rec[]) => new Map(rows.map((r) => [str(r, 'date'), r]))
    const b = byDate(bal)
    const c = byDate(cf)
    return inc
      .map<AnnualFinancials>((i) => {
        const date = str(i, 'date') ?? ''
        const bs = b.get(date)
        const cs = c.get(date)
        const ocf = num(cs, 'operatingCashFlow', 'netCashProvidedByOperatingActivities')
        const capex = abs(num(cs, 'capitalExpenditure', 'investmentsInPropertyPlantAndEquipment'))
        return {
          fiscalYear: Number(str(i, 'fiscalYear', 'calendarYear')) || Number(date.slice(0, 4)),
          periodEnd: date,
          sourceId: 'fmp',
          revenue: num(i, 'revenue'),
          costOfRevenue: num(i, 'costOfRevenue'),
          grossProfit: num(i, 'grossProfit'),
          researchAndDevelopment: num(i, 'researchAndDevelopmentExpenses'),
          sellingGeneralAdmin: num(i, 'sellingGeneralAndAdministrativeExpenses'),
          operatingIncome: num(i, 'operatingIncome'),
          interestExpense: num(i, 'interestExpense'),
          pretaxIncome: num(i, 'incomeBeforeTax'),
          incomeTax: num(i, 'incomeTaxExpense'),
          netIncome: num(i, 'netIncome'),
          epsDiluted: num(i, 'epsDiluted', 'epsdiluted'),
          sharesDiluted: num(i, 'weightedAverageShsOutDil'),
          ebitda: num(i, 'ebitda'),
          depreciation: num(i, 'depreciationAndAmortization'),
          cash: num(bs, 'cashAndCashEquivalents'),
          shortTermInvestments: num(bs, 'shortTermInvestments'),
          longTermInvestments: num(bs, 'longTermInvestments'),
          receivables: num(bs, 'netReceivables'),
          inventory: num(bs, 'inventory'),
          currentAssets: num(bs, 'totalCurrentAssets'),
          netPPE: num(bs, 'propertyPlantEquipmentNet'),
          goodwill: num(bs, 'goodwill'),
          intangibles: num(bs, 'intangibleAssets'),
          totalAssets: num(bs, 'totalAssets'),
          currentLiabilities: num(bs, 'totalCurrentLiabilities'),
          totalLiabilities: num(bs, 'totalLiabilities'),
          shortTermDebt: num(bs, 'shortTermDebt'),
          longTermDebt: num(bs, 'longTermDebt'),
          totalDebt: num(bs, 'totalDebt'),
          equity: num(bs, 'totalStockholdersEquity'),
          operatingCashFlow: ocf,
          capex,
          freeCashFlow: num(cs, 'freeCashFlow') ?? (ocf !== null && capex !== null ? ocf - capex : null),
          stockBasedCompensation: num(cs, 'stockBasedCompensation'),
          dividendsPaid: abs(num(cs, 'commonDividendsPaid', 'dividendsPaid', 'netDividendsPaid')),
          buybacks: abs(num(cs, 'commonStockRepurchased')),
          acquisitions: abs(num(cs, 'acquisitionsNet')),
          dividendPerShare: null,
          fiscalYearEndPrice: null,
        }
      })
      .sort((a, b2) => a.fiscalYear - b2.fiscalYear)
  },

  async getEstimates(ticker) {
    const [targets, est] = await Promise.all([
      get<Rec[]>('price-target-consensus', { symbol: ticker }, 86400).catch(() => [] as Rec[]),
      get<Rec[]>('analyst-estimates', { symbol: ticker, period: 'annual', limit: 4 }, 86400).catch(() => [] as Rec[]),
    ])
    const t = targets[0]
    const now = new Date().toISOString().slice(0, 10)
    const future = est.filter((e) => (str(e, 'date') ?? '') > now).sort((a, b) => (str(a, 'date') ?? '').localeCompare(str(b, 'date') ?? ''))
    if (!t && future.length === 0) return null
    return {
      sourceId: 'fmp',
      analystCount: num(future[0], 'numAnalystsEps', 'numberAnalystsEstimatedEps'),
      targetLow: num(t, 'targetLow'),
      targetMedian: num(t, 'targetMedian'),
      targetMean: num(t, 'targetConsensus'),
      targetHigh: num(t, 'targetHigh'),
      revenueNextFY: num(future[0], 'revenueAvg', 'estimatedRevenueAvg'),
      epsNextFY: num(future[0], 'epsAvg', 'estimatedEpsAvg'),
      epsNextFY2: num(future[1], 'epsAvg', 'estimatedEpsAvg'),
      longTermEpsGrowth: null,
      asOf: now,
    } satisfies AnalystEstimates
  },

  async getEarnings(ticker) {
    const rows = await get<Rec[]>('earnings', { symbol: ticker, limit: 16 }, 86400)
    return rows
      .filter((r) => num(r, 'epsActual') !== null)
      .slice(0, 12)
      .reverse()
      .map<EarningsQuarter>((r) => ({
        period: str(r, 'date') ?? '',
        reportDate: str(r, 'date') ?? '',
        epsActual: num(r, 'epsActual'),
        epsEstimate: num(r, 'epsEstimated'),
        revenueActual: num(r, 'revenueActual'),
        revenueEstimate: num(r, 'revenueEstimated'),
      }))
  },
}
