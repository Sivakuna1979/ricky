import type { CompanyDataset, SourceRef } from '@/lib/domain/types'
import { demoDataset, DEMO_FULL_TICKERS, DEMO_UNIVERSE } from '@/lib/providers/demo'
import { configuredProviders, providerFor } from '@/lib/providers/registry'
import type { SearchResult } from '@/lib/providers/types'
import { edgarIndexUrl } from '@/lib/providers/sec-edgar'

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

  const [profile, quote, annual, prices, estimates, earnings, filings] = await Promise.all([
    settle(profileP?.getProfile?.(ticker), null),
    settle(quoteP?.getQuote?.(ticker), null),
    settle(fin.getAnnualFinancials?.(ticker, 11), []),
    settle(pricesP?.getPrices?.(ticker, tenYearsAgo), []),
    settle(estP?.getEstimates?.(ticker), null),
    settle(earnP?.getEarnings?.(ticker), []),
    settle(filingsP?.getFilings?.(ticker), []),
  ])
  if (!profile || !quote || annual.length === 0) return null

  // Attach fiscal-year-end prices from the price history (for historical multiples).
  for (const y of annual) {
    const p = [...prices].reverse().find((pp) => pp.date <= y.periodEnd)
    y.fiscalYearEndPrice = p ? p.close : null
  }

  const sources: Record<string, SourceRef> = {}
  for (const p of configuredProviders()) sources[p.id] = p.sourceRef(ticker)

  return {
    mode: 'live',
    profile,
    quote,
    annual,
    prices,
    pricesSynthetic: false,
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
