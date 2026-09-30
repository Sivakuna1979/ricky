import type { CompanyDataset } from '@/lib/domain/types'
import { APPLE_ANNUAL, APPLE_EARNINGS, APPLE_ESTIMATES, APPLE_QUALITATIVE, APPLE_SEGMENTS, APPLE_SOURCES, DEMO_UPDATED } from './apple'
import { APPLE_PEERS, DEMO_INDUSTRY_TECH, DEMO_UNIVERSE } from './universe'
import { syntheticPriceSeries } from './synthetic-prices'

export { DEMO_UNIVERSE } from './universe'

const DEMO_PRICE = 255

/** Tickers with a full demo dataset (the analysis engine can run end-to-end). */
export const DEMO_FULL_TICKERS = ['AAPL']

let cachedApple: CompanyDataset | null = null

export function demoDataset(ticker: string): CompanyDataset | null {
  if (ticker.toUpperCase() !== 'AAPL') return null
  if (cachedApple) return cachedApple

  const anchors = APPLE_ANNUAL.filter((y) => y.fiscalYear >= 2016).map((y) => ({ date: y.periodEnd, price: y.fiscalYearEndPrice as number }))
  anchors.push({ date: '2026-03-31', price: 228 }, { date: DEMO_UPDATED, price: DEMO_PRICE })
  const prices = syntheticPriceSeries(anchors)
  const last = prices[prices.length - 1]
  const prev = prices[prices.length - 2]
  const year = prices.slice(-252)
  const sharesOut = 14.8e9 // demo shares outstanding at quote date

  cachedApple = {
    mode: 'demo',
    profile: {
      ticker: 'AAPL',
      name: 'Apple Inc.',
      exchange: 'NASDAQ',
      country: 'United States',
      currency: 'USD',
      sector: 'Technology',
      industry: 'Consumer Electronics',
      description:
        'Apple designs, manufactures (through partners) and markets smartphones, personal computers, tablets, wearables and accessories, and sells a growing range of subscription and platform services to its installed base of devices.',
      website: 'https://www.apple.com',
      cik: '0000320193',
      fiscalYearEndMonth: 9,
      ipoDate: '1980-12-12',
      employees: null,
      ceo: 'Tim Cook',
      ceoSince: 2011,
      sourceId: 'demo-fin',
    },
    quote: {
      price: last.close,
      change: Math.round((last.close - prev.close) * 100) / 100,
      changePct: ((last.close - prev.close) / prev.close) * 100,
      marketCap: last.close * sharesOut,
      yearHigh: Math.max(...year.map((p) => p.close)),
      yearLow: Math.min(...year.map((p) => p.close)),
      volume: last.volume ?? null,
      avgVolume: year.slice(-60).reduce((s, p) => s + (p.volume ?? 0), 0) / 60,
      asOf: DEMO_UPDATED,
      sourceId: 'demo-quote',
    },
    annual: APPLE_ANNUAL,
    prices,
    pricesSynthetic: true,
    segments: APPLE_SEGMENTS,
    estimates: APPLE_ESTIMATES,
    earnings: APPLE_EARNINGS,
    filings: [
      { form: '10-K', filedAt: '', description: 'Annual report', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000320193&type=10-K&owner=include&count=40' },
      { form: '10-Q', filedAt: '', description: 'Quarterly reports', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000320193&type=10-Q&owner=include&count=40' },
      { form: '8-K', filedAt: '', description: 'Current reports (material events, earnings releases)', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000320193&type=8-K&owner=include&count=40' },
      { form: 'DEF 14A', filedAt: '', description: 'Proxy statement (executive pay, board, votes)', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000320193&type=DEF+14A&owner=include&count=40' },
      { form: 'Form 4', filedAt: '', description: 'Insider transactions', url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000320193&type=4&owner=only&count=40' },
    ],
    filingsIndexUrl: APPLE_SOURCES['sec-edgar'].url,
    qualitative: APPLE_QUALITATIVE,
    peers: DEMO_UNIVERSE.filter((c) => APPLE_PEERS.includes(c.ticker)),
    industry: DEMO_INDUSTRY_TECH,
    ownership: null,
    shortInterest: null,
    sources: APPLE_SOURCES,
    generatedAt: new Date().toISOString(),
  }
  return cachedApple
}
