import type { PricePoint, Quote, SourceRef } from '@/lib/domain/types'
import { fetchJson, ProviderError, type DataProvider } from '../types'

/**
 * Alpha Vantage adapter — quotes and weekly adjusted price history.
 * A free API key exists (low daily request limits); paid tiers raise them.
 * Weekly history is used because full daily history is a premium endpoint;
 * the dataset marks the interval so daily-based technical indicators are skipped
 * rather than computed on the wrong frequency.
 */
const BASE = 'https://www.alphavantage.co/query'

async function av<T>(params: Record<string, string>, revalidateSeconds: number): Promise<T> {
  const qs = new URLSearchParams({ ...params, apikey: process.env.ALPHA_VANTAGE_API_KEY ?? '' })
  const data = await fetchJson<T & { Note?: string; Information?: string; 'Error Message'?: string }>('alpha-vantage', `${BASE}?${qs}`, { revalidateSeconds })
  const msg = data.Note ?? data.Information ?? data['Error Message']
  if (msg) throw new ProviderError('alpha-vantage', msg)
  return data
}

const n = (v: string | undefined) => {
  const x = v === undefined ? NaN : Number(v.replace('%', ''))
  return Number.isFinite(x) ? x : null
}

export const alphaVantageProvider: DataProvider = {
  id: 'alpha-vantage',
  name: 'Alpha Vantage',
  capabilities: ['quote', 'prices'],
  isConfigured: () => Boolean(process.env.ALPHA_VANTAGE_API_KEY),
  sourceRef(): SourceRef {
    return { id: 'alpha-vantage', name: 'Alpha Vantage — end-of-day quotes and weekly adjusted prices', tier: 'provider', url: 'https://www.alphavantage.co/', updated: new Date().toISOString().slice(0, 10) }
  },

  async getQuote(ticker) {
    const d = await av<{ 'Global Quote'?: Record<string, string> }>({ function: 'GLOBAL_QUOTE', symbol: ticker }, 900)
    const q = d['Global Quote']
    if (!q || !q['05. price']) return null
    return {
      price: n(q['05. price']),
      change: n(q['09. change']),
      changePct: n(q['10. change percent']),
      marketCap: null, // filled from SEC cover-page shares × price when available
      yearHigh: null,
      yearLow: null,
      volume: n(q['06. volume']),
      avgVolume: null,
      asOf: q['07. latest trading day'] ?? new Date().toISOString().slice(0, 10),
      sourceId: 'alpha-vantage',
    } satisfies Quote
  },

  async getPrices(ticker, fromDate) {
    const d = await av<{ 'Weekly Adjusted Time Series'?: Record<string, Record<string, string>> }>({ function: 'TIME_SERIES_WEEKLY_ADJUSTED', symbol: ticker }, 86_400)
    const series = d['Weekly Adjusted Time Series'] ?? {}
    return Object.entries(series)
      .filter(([date]) => date >= fromDate)
      .map<PricePoint>(([date, v]) => ({ date, close: n(v['5. adjusted close']) ?? NaN, volume: n(v['6. volume']) ?? undefined }))
      .filter((p) => Number.isFinite(p.close))
      .sort((a, b) => a.date.localeCompare(b.date))
  },
}
