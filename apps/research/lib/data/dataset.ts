import type { CompanyDataset, Quote, SourceRef } from '@/lib/domain/types'
import { demoDataset, DEMO_FULL_TICKERS, DEMO_UNIVERSE } from '@/lib/providers/demo'
import { providerFor } from '@/lib/providers/registry'
import type { DataProvider, SearchResult } from '@/lib/providers/types'
import { edgarIndexUrl, secSharesOutstanding } from '@/lib/providers/sec-edgar'

/** Server-only. Normalises and validates a user-supplied ticker. */
export function normaliseTicker(raw: string): string | null {
  const t = raw.trim().toUpperCase()
  return /^[A-Z0-9][A-Z0-9.\-]{0,9}$/.test(t) ? t : null
}

export function liveDataEnabled() {
  return providerFor('financials') !== null
}

/**
 * Builds a CompanyDataset for a ticker.
 *  1. If a live financials provider is configured → sourced data.
 *  2. Otherwise, if a demo dataset exists → DEMO data (clearly labelled).
 *  3. Otherwise → null (the UI says data is unavailable; nothing is invented).
 */
export async function getCompanyDataset(ticker: string): Promise<CompanyDataset | null> {
  const fin = providerFor('financials')
  if (!fin) return demoDataset(ticker)

  const quoteP = providerFor('quote')
  const profileP = providerFor('profile')
  const pricesP = providerFor('prices')
  const estP = providerFor('estimates')
  const earnP = providerFor('earnings')
  const filingsP = providerFor('filings')

  const tenYearsAgo = new Date(Date.now() - 10.5 * 365 * 86400_000).toISOString().slice(0, 10)
  const settle = <T,>(p: Promise<T> | undefined, fallback: T) => (p ? p.catch(() => fallback) : Promise.resolve(fallback))

  const [profile, quoteRaw, annual, prices, estimates, earnings, filings] = await Promise.all([
    settle(profileP?.getProfile?.(ticker), null),
    settle(quoteP?.getQuote?.(ticker), null),
    settle(fin.getAnnualFinancials?.(ticker, 11), []),
    settle(pricesP?.getPrices?.(ticker, tenYearsAgo), []),
    settle(estP?.getEstimates?.(ticker), null),
    settle(earnP?.getEarnings?.(ticker), []),
    settle(filingsP?.getFilings?.(ticker), []),
  ])
  if (!profile || annual.length === 0) return null

  // Weekly bars (e.g. Alpha Vantage free tier) are flagged so daily indicators are skipped.
  const gaps = prices.slice(-30).map((p, i, arr) => (i ? (Date.parse(p.date) - Date.parse(arr[i - 1].date)) / 86_400_000 : 0)).slice(1)
  const pricesInterval: 'daily' | 'weekly' = gaps.length && gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] >= 5 ? 'weekly' : 'daily'

  // Attach fiscal-year-end prices from the price history (for historical multiples).
  for (const y of annual) {
    const p = [...prices].reverse().find((pp) => pp.date <= y.periodEnd)
    y.fiscalYearEndPrice = p && Date.parse(y.periodEnd) - Date.parse(p.date) < 10 * 86_400_000 ? p.close : null
  }

  // Quote: optional. Without a quote provider, price-based sections show "Data unavailable".
  const quote: Quote = quoteRaw ?? { price: null, change: null, changePct: null, marketCap: null, yearHigh: null, yearLow: null, volume: null, avgVolume: null, asOf: new Date().toISOString(), sourceId: 'none' }
  if (quote.marketCap === null && quote.price !== null) {
    const shares = (await settle(secSharesOutstanding(ticker), null)) ?? annual[annual.length - 1].sharesDiluted
    quote.marketCap = shares ? quote.price * shares : null
  }
  const year = prices.filter((p) => Date.parse(p.date) > Date.now() - 365 * 86_400_000).map((p) => p.close)
  if (quote.yearHigh === null && year.length) quote.yearHigh = Math.max(...year)
  if (quote.yearLow === null && year.length) quote.yearLow = Math.min(...year)

  // Only list the providers whose data is actually on the page.
  const used = new Set<DataProvider>([fin, profileP, quoteRaw ? quoteP : null, prices.length ? pricesP : null, estimates ? estP : null, earnings.length ? earnP : null, filings.length ? filingsP : null].filter((x): x is DataProvider => Boolean(x)))
  const sources: Record<string, SourceRef> = {}
  for (const p of used) sources[p.id] = p.sourceRef(ticker)

  return {
    mode: 'live',
    profile,
    quote,
    annual,
    prices,
    pricesSynthetic: false,
    pricesInterval,
    segments: null,
    estimates,
    earnings,
    filings,
    filingsIndexUrl: profile.cik ? edgarIndexUrl(profile.cik.padStart(10, '0')) : undefined,
    qualitative: null, // requires reviewed editorial inputs — never generated on the fly
    peers: [], // peer discovery requires a provider peers endpoint (planned)
    industry: null,
    ownership: null,
    shortInterest: null,
    sources,
    generatedAt: new Date().toISOString(),
  }
}

export async function searchCompanies(query: string): Promise<SearchResult[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const live = providerFor('search')
  if (live?.search) {
    try {
      return await live.search(query)
    } catch {
      /* fall through to demo universe */
    }
  }
  const universe = [
    { ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
    ...DEMO_UNIVERSE.map((c) => ({ ticker: c.ticker, name: c.name, exchange: c.exchange })),
  ]
  return universe
    .filter((c) => c.ticker.toLowerCase().startsWith(q) || c.name.toLowerCase().includes(q))
    .slice(0, 8)
    .map((c) => ({ ...c, hasFullAnalysis: DEMO_FULL_TICKERS.includes(c.ticker) }))
}
