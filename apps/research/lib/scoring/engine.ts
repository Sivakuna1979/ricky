import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  overallSignal,
  type CategoryKey,
  type CategoryScore,
  type Contribution,
  type Indicator,
  type InvestorMode,
  type OverallScore,
  type SignalCounts,
  type Weights,
} from './types'
import { weightsFor } from './weights'

/** Category score = weight-averaged indicator scores, over indicators with data. */
export function scoreCategories(indicators: Indicator[]): CategoryScore[] {
  return CATEGORY_ORDER.map((key) => {
    const list = indicators.filter((i) => i.category === key)
    const scored = list.filter((i) => i.score !== null)
    const wSum = scored.reduce((s, i) => s + i.weight, 0)
    const score = wSum > 0 ? scored.reduce((s, i) => s + (i.score as number) * i.weight, 0) / wSum : null
    return { key, label: CATEGORY_LABELS[key], score: score === null ? null : Math.round(score), indicators: list, available: scored.length, total: list.length }
  })
}

/**
 * Overall = Σ category weight × category score, renormalised over categories
 * that have data. Every indicator's contribution is reported relative to the
 * neutral baseline of 50, so:  overall = 50 + Σ contributions.points
 */
export function scoreOverall(categories: CategoryScore[], mode: InvestorMode, custom?: Weights): OverallScore {
  const raw = weightsFor(mode, custom)
  const usable = categories.filter((c) => c.score !== null && raw[c.key] > 0)
  const excluded = categories.filter((c) => c.score === null && raw[c.key] > 0).map((c) => c.key)
  const total = usable.reduce((s, c) => s + raw[c.key], 0)
  const weightsUsed = Object.fromEntries(CATEGORY_ORDER.map((k) => [k, 0])) as Weights
  if (total === 0) {
    return { mode, score: null, weightsUsed, excluded, categoryContributions: [], contributions: [], signal: overallSignal(null) }
  }
  for (const c of usable) weightsUsed[c.key] = (raw[c.key] / total) * 100

  const contributions: Contribution[] = []
  const categoryContributions = usable.map((c) => {
    const w = weightsUsed[c.key] / 100
    const scored = c.indicators.filter((i) => i.score !== null)
    const wSum = scored.reduce((s, i) => s + i.weight, 0)
    // Use the unrounded category mean so contributions sum exactly.
    for (const i of scored) {
      contributions.push({ indicatorId: i.id, label: i.label, category: c.key, score: i.score as number, points: (w * i.weight * ((i.score as number) - 50)) / wSum })
    }
    const exact = scored.reduce((s, i) => s + (i.score as number) * i.weight, 0) / wSum
    return { key: c.key, score: c.score as number, weight: weightsUsed[c.key], points: w * (exact - 50) }
  })
  const score = 50 + categoryContributions.reduce((s, c) => s + c.points, 0)
  contributions.sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
  const rounded = Math.round(score)
  return { mode, score: rounded, weightsUsed, excluded, categoryContributions, contributions, signal: overallSignal(rounded) }
}

export function countSignals(indicators: Indicator[]): SignalCounts {
  const c: SignalCounts = { strong_positive: 0, positive: 0, neutral: 0, negative: 0, strong_negative: 0, unavailable: 0 }
  for (const i of indicators) c[i.rating]++
  return c
}

export function categoryScore(categories: CategoryScore[], key: CategoryKey): number | null {
  return categories.find((c) => c.key === key)?.score ?? null
}

export type RiskLevel = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH'
export function riskLevel(riskScore: number | null): RiskLevel | null {
  if (riskScore === null) return null
  if (riskScore >= 75) return 'LOW'
  if (riskScore >= 60) return 'MODERATE'
  if (riskScore >= 45) return 'ELEVATED'
  return 'HIGH'
}

export type ValuationLabel = 'Deeply Undervalued' | 'Undervalued' | 'Fairly Valued' | 'Premium Valuation' | 'Expensive' | 'Extremely Expensive'
export function valuationLabel(score: number | null): ValuationLabel | null {
  if (score === null) return null
  if (score >= 80) return 'Deeply Undervalued'
  if (score >= 65) return 'Undervalued'
  if (score >= 50) return 'Fairly Valued'
  if (score >= 38) return 'Premium Valuation'
  if (score >= 25) return 'Expensive'
  return 'Extremely Expensive'
}

export type BalanceSheetLabel = 'Very Strong' | 'Strong' | 'Moderate' | 'Weak' | 'High Risk'
export function balanceSheetLabel(score: number | null): BalanceSheetLabel | null {
  if (score === null) return null
  if (score >= 80) return 'Very Strong'
  if (score >= 65) return 'Strong'
  if (score >= 50) return 'Moderate'
  if (score >= 35) return 'Weak'
  return 'High Risk'
}

export type MoatRating = 'None' | 'Narrow' | 'Moderate' | 'Wide' | 'Exceptional'
export function moatRating(score: number | null): MoatRating | null {
  if (score === null) return null
  if (score >= 92) return 'Exceptional'
  if (score >= 72) return 'Wide'
  if (score >= 55) return 'Moderate'
  if (score >= 35) return 'Narrow'
  return 'None'
}
