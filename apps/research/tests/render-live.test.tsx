import { describe, expect, it, vi, beforeAll } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import type { CompanyAnalysis } from '@/lib/analysis/build'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }))

/** Renders every dashboard section for a live company with no price data, catching null-handling crashes. */
let a: CompanyAnalysis
beforeAll(async () => {
  const { demoDataset } = await import('@/lib/providers/demo')
  const { buildAnalysis } = await import('@/lib/analysis/build')
  const demo = demoDataset('AAPL')!
  const nullQuote = { ...demo.quote, price: null, change: null, changePct: null, marketCap: null, yearHigh: null, yearLow: null, sourceId: 'none' }
  a = buildAnalysis({
    ...demo,
    mode: 'live',
    quote: nullQuote,
    prices: [],
    annual: demo.annual.map((y) => ({ ...y, fiscalYearEndPrice: null, interestExpense: null, dividendPerShare: null })),
    segments: null,
    estimates: null,
    earnings: [],
    filings: [],
    qualitative: null,
    peers: [],
    industry: null,
    sources: { 'demo-fin': demo.sources['demo-fin'] },
  })!
})

describe('dashboard renders with sparse live data', () => {
  it('renders all sections without throwing', async () => {
    const mods = await Promise.all([
      import('@/components/company/header'),
      import('@/components/company/sections-summary'),
      import('@/components/company/sections-fundamentals'),
      import('@/components/company/sections-valuation'),
      import('@/components/company/sections-quality'),
      import('@/components/company/sections-market'),
      import('@/components/company/sections-future'),
      import('@/components/company/score-explorer'),
    ])
    const comps: [string, (p: { a: CompanyAnalysis }) => unknown][] = []
    for (const m of mods) for (const [k, v] of Object.entries(m)) if (typeof v === 'function' && /^[A-Z]/.test(k) && k !== 'Psychology' && k !== 'ScoreExplorer' && k !== 'CompanyHeader') comps.push([k, v as never])
    for (const [name, C] of comps) {
      const html = renderToString(createElement(C as never, { a } as never))
      expect(html.length, name).toBeGreaterThan(20)
    }
    expect(renderToString(createElement(mods[0].CompanyHeader, { a, canReport: true }))).toContain('Data unavailable')
    expect(renderToString(createElement(mods[7].ScoreExplorer, { categories: a.categories, confidence: a.confidence.score }))).toContain('Investment Quality Score')
  })
})
