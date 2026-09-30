import { describe, expect, it } from 'vitest'
import { parseQuery, applyFilters, describeFilter } from '@/lib/screener/filters'
import { getUniverse } from '@/lib/screener/universe'
import { snapshotScores } from '@/lib/scoring/snapshot'
import { analysePortfolio } from '@/lib/portfolio/analytics'
import { evaluateAlert } from '@/lib/alerts/rules'
import { runBacktest, randomSelfTest, parseObservationsCsv, bucketOf } from '@/lib/backtest/engine'
import { fallbackAnswer, detectIntent } from '@/lib/ai/fallback'
import { detectTickers, loadSubjects, buildContext } from '@/lib/ai/context'
import { hasFeature } from '@/lib/plans'
import { renderReport } from '@/lib/report/pdf'
import { demoDataset } from '@/lib/providers/demo'
import { buildAnalysis } from '@/lib/analysis/build'

describe('plans', () => {
  it('gates features by plan rank', () => {
    expect(hasFeature('free', 'basic_analysis')).toBe(true)
    expect(hasFeature('free', 'ai')).toBe(false)
    expect(hasFeature('premium', 'ai')).toBe(true)
    expect(hasFeature('premium', 'backtesting')).toBe(false)
    expect(hasFeature('professional', 'backtesting')).toBe(true)
  })
})

describe('screener', () => {
  it('translates the example query into explicit filters', () => {
    const r = parseQuery('Find profitable companies with ROIC above 15%, revenue growth above 10%, positive FCF and reasonable valuation')
    const d = r.filters.map(describeFilter)
    expect(d).toContain('ROIC > 15%')
    expect(d).toContain('Revenue growth > 10%')
    expect(d).toContain('Net margin > 0%')
    expect(d).toContain('Free cash flow > $0B')
    expect(d.some((x) => x.startsWith('Valuation score >'))).toBe(true)
    expect(r.unparsed).toEqual([])
  })

  it('handles below / sectors / unknown fragments', () => {
    const r = parseQuery('tech stocks with P/E below 30 and purple unicorns')
    expect(r.filters.map(describeFilter)).toEqual(expect.arrayContaining(['P/E < 30×', 'sector: technology']))
    expect(r.unparsed).toContain('purple unicorns')
  })

  it('excludes rows with missing data rather than passing them', () => {
    const rows = getUniverse()
    const out = applyFilters(rows, [{ kind: 'num', field: 'peg', op: 'lt', value: 100 }])
    expect(out.find((x) => x.ticker === 'TSLA')).toBeUndefined() // TSLA peg is null in demo data
  })

  it('snapshot scores are bounded and labelled', () => {
    const s = snapshotScores(getUniverse().find((r) => r.ticker === 'MSFT')!)
    expect(s.kind).toBe('snapshot')
    expect(s.overall).toBeGreaterThanOrEqual(0)
    expect(s.overall).toBeLessThanOrEqual(100)
    expect(getUniverse()[0].scores.kind).toBe('full')
  })
})

describe('portfolio analytics', () => {
  const base = { name: 'x', dividendYield: 1, score: 70, scoreKind: 'snapshot' as const }
  it('computes value, P/L, weights and concentration warnings', () => {
    const a = analysePortfolio([
      { ...base, id: '1', ticker: 'AAA', sector: 'Tech', country: 'US', quantity: 10, purchasePrice: 100, price: 150 },
      { ...base, id: '2', ticker: 'BBB', sector: 'Tech', country: 'US', quantity: 10, purchasePrice: 50, price: 50 },
    ])
    expect(a.value).toBe(2000)
    expect(a.cost).toBe(1500)
    expect(a.pnl).toBe(500)
    expect(a.positions[0].weight).toBeCloseTo(75)
    expect(a.warnings.some((w) => w.text.includes('AAA'))).toBe(true)
    expect(a.warnings.some((w) => w.text.includes('Tech'))).toBe(true)
  })
  it('carries unpriced positions at cost and says so', () => {
    const a = analysePortfolio([{ ...base, id: '1', ticker: 'ZZZ', sector: 'X', country: 'Y', quantity: 2, purchasePrice: 10, price: null }])
    expect(a.value).toBe(20)
    expect(a.positions[0].pnlPct).toBeNull()
    expect(a.warnings.some((w) => w.text.includes('No current price'))).toBe(true)
  })
})

describe('alerts', () => {
  it('evaluates price, valuation and event rules', () => {
    expect(evaluateAlert({ id: '1', ticker: 'A', kind: 'price_below', value: 100, active: true }, { price: 90 }).state).toBe('triggered')
    expect(evaluateAlert({ id: '1', ticker: 'A', kind: 'pe_below', value: 20, active: true }, { pe: 30 }).state).toBe('watching')
    expect(evaluateAlert({ id: '1', ticker: 'A', kind: 'price_above', value: 1, active: true }, {}).state).toBe('no_data')
    expect(evaluateAlert({ id: '1', ticker: 'A', kind: 'new_filing', active: true }, {}).state).toBe('awaiting_feed')
  })
})

describe('backtest engine', () => {
  it('buckets scores', () => {
    expect(bucketOf(80)).toBe('80-100')
    expect(bucketOf(79.9)).toBe('60-79')
    expect(bucketOf(10)).toBe('<40')
  })
  it('excludes look-ahead observations and flags survivorship', () => {
    const r = runBacktest([
      { ticker: 'A', scoreDate: '2015-06-30', dataAvailableAt: '2015-09-01', score: 90, delisted: false, forward: { 1: 10 }, benchmark: { 1: 5 } },
      { ticker: 'B', scoreDate: '2015-06-30', dataAvailableAt: '2015-05-01', score: 90, delisted: false, forward: { 1: 10 }, benchmark: { 1: 5 } },
    ])
    expect(r.excludedLookAhead).toBe(1)
    expect(r.used).toBe(1)
    expect(r.warnings.some((w) => w.includes('survivorship'))).toBe(true)
    const top = r.stats.find((s) => s.bucket === '80-100' && s.horizon === 1)!
    expect(top.meanExcess).toBe(5)
    expect(top.hitRate).toBe(100)
  })
  it('random self-test shows no strong bucket effect and catches leaks', () => {
    const r = runBacktest(randomSelfTest())
    expect(r.excludedLookAhead).toBeGreaterThan(0)
    const ex = r.stats.filter((s) => s.horizon === 1).map((s) => s.meanExcess as number)
    expect(Math.max(...ex) - Math.min(...ex)).toBeLessThan(8) // no real signal
  })
  it('parses CSV', () => {
    const obs = parseObservationsCsv('ticker,score_date,data_available_at,score,delisted,ret_1y,bench_1y\nX,2016-01-01,2015-12-01,72,true,12.5,8')
    expect(obs[0]).toMatchObject({ ticker: 'X', score: 72, delisted: true })
    expect(obs[0].forward[1]).toBe(12.5)
  })
})

describe('AI research (rules mode)', () => {
  it('detects tickers and intents', () => {
    expect(detectTickers('Compare Apple and Microsoft', ['AAPL', 'MSFT'])).toEqual(['AAPL', 'MSFT'])
    expect(detectIntent('Explain Apple’s debt', 1)).toBe('debt')
    expect(detectIntent('What could the business look like in 10 years?', 1)).toBe('future')
  })
  it('answers only from computed figures, with epistemic tags and demo note', async () => {
    const subjects = await loadSubjects(['AAPL'])
    const debt = fallbackAnswer('Explain Apple’s debt', subjects)
    expect(debt).toContain('Net debt / EBITDA')
    expect(debt).toContain('[Fact]')
    expect(debt).toContain('demo dataset')
    const fut = fallbackAnswer('What could Apple look like in 10 years?', subjects)
    expect(fut).toContain('[Uncertainty]')
    expect(fut).toContain('[Scenario]')
    expect(JSON.parse(buildContext(subjects))[0].dataMode).toBe('demo')
  })
  it('refuses to guess without data', () => {
    expect(fallbackAnswer('Explain the debt', [])).toMatch(/could not identify/)
  })
})

describe('PDF report', () => {
  it('renders a valid PDF', async () => {
    const pdf = await renderReport(buildAnalysis(demoDataset('AAPL')!)!)
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.length).toBeGreaterThan(5000)
  })
})

describe('billing', () => {
  it('maps subscription status to plan and records trial/period dates', async () => {
    const { planForStatus, recordFromSubscription } = await import('@/lib/billing/stripe')
    expect(planForStatus('trialing')).toBe('premium')
    expect(planForStatus('active')).toBe('premium')
    expect(planForStatus('past_due')).toBe('premium')
    expect(planForStatus('canceled')).toBe('free')
    expect(planForStatus('incomplete')).toBe('free')
    const rec = recordFromSubscription({
      id: 'sub_1',
      status: 'trialing',
      trial_end: 1_800_000_000,
      cancel_at_period_end: false,
      customer: 'cus_1',
      items: { data: [{ current_period_end: 1_800_000_000 }] },
    } as never)
    expect(rec).toMatchObject({ plan: 'premium', stripe_customer_id: 'cus_1', has_used_trial: true, trial_ends_at: new Date(1_800_000_000_000).toISOString() })
  })
})
