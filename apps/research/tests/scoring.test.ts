import { describe, expect, it } from 'vitest'
import { demoDataset } from '@/lib/providers/demo'
import { buildAnalysis } from '@/lib/analysis/build'
import { scoreOverall } from '@/lib/scoring/engine'
import { MODE_WEIGHTS, sumWeights } from '@/lib/scoring/weights'
import { cagr, growth } from '@/lib/finance/stats'
import { runDcf } from '@/lib/finance/dcf'
import { grahamNumber } from '@/lib/finance/valuation'
import { rsi, sma } from '@/lib/finance/technical'
import { compound } from '@/lib/finance/scenarios'

describe('finance primitives', () => {
  it('computes CAGR and refuses negative bases', () => {
    expect(cagr(100, 121, 2)).toBeCloseTo(10, 6)
    expect(cagr(-5, 10, 3)).toBeNull()
    expect(growth(0, 10)).toBeNull()
  })

  it('Graham number', () => {
    expect(grahamNumber(2, 20)).toBeCloseTo(Math.sqrt(22.5 * 40), 6)
    expect(grahamNumber(-1, 20)).toBeNull()
  })

  it('DCF: known two-stage value and guard rails', () => {
    const r = runDcf({ method: 'fcf', currentFcf: 100, fcfGrowth: 0, currentRevenue: 0, revenueGrowth: 0, operatingMargin: 0, taxRate: 0, fcfConversion: 100, wacc: 10, terminalGrowth: 0, netDebt: 0, shares: 1 })
    // zero growth perpetuity = FCF / WACC
    expect(r.perShare).toBeCloseTo(1000, 6)
    expect(runDcf({ method: 'fcf', currentFcf: 100, fcfGrowth: 5, currentRevenue: 0, revenueGrowth: 0, operatingMargin: 0, taxRate: 0, fcfConversion: 100, wacc: 3, terminalGrowth: 3, netDebt: 0, shares: 1 }).valid).toBe(false)
  })

  it('technical indicators', () => {
    expect(sma([1, 2, 3, 4], 2)).toBe(3.5)
    const up = Array.from({ length: 40 }, (_, i) => i + 1)
    expect(rsi(up)).toBe(100)
  })

  it('compounding', () => {
    expect(compound(10000, 10, 2)).toBeCloseTo(12100, 6)
  })
})

describe('scoring engine', () => {
  it('every preset weight set sums to 100', () => {
    for (const w of Object.values(MODE_WEIGHTS)) expect(sumWeights(w)).toBeCloseTo(100, 6)
  })

  const ds = demoDataset('AAPL')!
  const a = buildAnalysis(ds)!

  it('builds a full, deterministic analysis for the demo', () => {
    expect(a).toBeTruthy()
    expect(buildAnalysis(ds)!.overall.score).toBe(a.overall.score)
    expect(a.overall.score).toBeGreaterThan(0)
    expect(a.overall.score).toBeLessThanOrEqual(100)
  })

  it('overall = 50 + Σ contributions (auditable)', () => {
    const sum = a.overall.contributions.reduce((s, c) => s + c.points, 0)
    expect(Math.round(50 + sum)).toBe(a.overall.score)
  })

  it('missing data is excluded, not scored as zero', () => {
    const unavailable = a.indicators.filter((i) => i.score === null)
    expect(unavailable.length).toBeGreaterThan(0) // e.g. interest coverage, sentiment
    expect(a.overall.excluded).toContain('sentiment')
  })

  it('technical indicators cannot dominate', () => {
    const tech = a.overall.categoryContributions.find((c) => c.key === 'technical')
    expect(Math.abs(tech?.points ?? 0)).toBeLessThanOrEqual(1.5)
  })

  it('demo data lowers confidence', () => {
    expect(a.confidence.score).toBeLessThan(90)
  })

  it('investor modes change the weighting', () => {
    const value = scoreOverall(a.categories, 'value')
    const growthMode = scoreOverall(a.categories, 'growth')
    expect(value.score).not.toBe(growthMode.score)
  })
})
