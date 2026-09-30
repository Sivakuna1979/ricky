import type {
  AnalystEstimates,
  AnnualFinancials,
  CompanyProfile,
  EarningsQuarter,
  Filing,
  PricePoint,
  Quote,
  SourceRef,
} from '@/lib/domain/types'

/**
 * Provider abstraction. Each vendor (FMP, Polygon, Finnhub, Tiingo, SEC EDGAR,
 * FRED…) implements only the capabilities it supports. The registry picks a
 * provider per capability, so vendors can be swapped or mixed without touching
 * the finance, scoring or UI layers.
 *
 * Adapters run server-side only: they read API keys from environment variables
 * and must never be imported into client components.
 */
export type Capability =
  | 'search'
  | 'profile'
  | 'quote'
  | 'prices'
  | 'financials'
  | 'estimates'
  | 'earnings'
  | 'filings'
  | 'ownership'
  | 'short_interest'
  | 'news'
  | 'macro'

export interface SearchResult {
  ticker: string
  name: string
  exchange?: string
  hasFullAnalysis: boolean
}

export interface DataProvider {
  id: string
  name: string
  capabilities: Capability[]
  /** True when credentials / config needed by the adapter are present. */
  isConfigured(): boolean
  /** Source reference attached to every figure this provider returns. */
  sourceRef(ticker: string): SourceRef

  search?(query: string): Promise<SearchResult[]>
  getProfile?(ticker: string): Promise<CompanyProfile | null>
  getQuote?(ticker: string): Promise<Quote | null>
  getPrices?(ticker: string, fromDate: string): Promise<PricePoint[]>
  getAnnualFinancials?(ticker: string, years: number): Promise<AnnualFinancials[]>
  getEstimates?(ticker: string): Promise<AnalystEstimates | null>
  getEarnings?(ticker: string): Promise<EarningsQuarter[]>
  getFilings?(ticker: string): Promise<Filing[]>
}

export class ProviderError extends Error {
  constructor(
    public providerId: string,
    message: string,
    public status?: number,
  ) {
    super(`[${providerId}] ${message}`)
  }
}

/** Shared fetch helper: timeout, JSON parsing, and Next.js data-cache revalidation. */
export async function fetchJson<T>(
  providerId: string,
  url: string,
  init: RequestInit & { revalidateSeconds?: number } = {},
): Promise<T> {
  const { revalidateSeconds = 3600, ...rest } = init
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
      next: { revalidate: revalidateSeconds },
    } as RequestInit)
    if (!res.ok) throw new ProviderError(providerId, `HTTP ${res.status}`, res.status)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}
