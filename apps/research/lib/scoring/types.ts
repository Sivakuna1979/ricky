import type { Num } from '@/lib/domain/types'

export type Rating = 'strong_positive' | 'positive' | 'neutral' | 'negative' | 'strong_negative' | 'unavailable'

export type CategoryKey =
  | 'financial_strength'
  | 'business_quality'
  | 'profitability'
  | 'growth'
  | 'cash_flow'
  | 'valuation'
  | 'management'
  | 'risk'
  | 'technical'
  | 'sentiment'
  | 'dividend'

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  financial_strength: 'Financial Strength',
  business_quality: 'Business Quality / Moat',
  profitability: 'Profitability',
  growth: 'Growth',
  cash_flow: 'Cash Flow',
  valuation: 'Valuation',
  management: 'Management & Capital Allocation',
  risk: 'Risk (higher = lower risk)',
  technical: 'Market / Technical',
  sentiment: 'Sentiment / Other',
  dividend: 'Dividend',
}

export const CATEGORY_ORDER: CategoryKey[] = [
  'financial_strength',
  'business_quality',
  'profitability',
  'growth',
  'cash_flow',
  'valuation',
  'management',
  'risk',
  'technical',
  'sentiment',
  'dividend',
]

/**
 * One scored piece of evidence. `score` is 0–100 from a documented curve;
 * 50 is neutral. A null score means the data was unavailable and the
 * indicator is excluded (not scored as zero).
 */
export interface Indicator {
  id: string
  category: CategoryKey
  label: string
  display: string
  value: Num
  score: number | null
  weight: number
  rating: Rating
  rationale: string
  /** Formula / benchmark / curve used, so every point is auditable. */
  basis: string
  sourceIds: string[]
  glossaryKey?: string
  /** Qualitative (editorial) inputs are marked so users can discount them. */
  qualitative?: boolean
}

export interface CategoryScore {
  key: CategoryKey
  label: string
  score: number | null
  indicators: Indicator[]
  available: number
  total: number
}

export type InvestorMode = 'balanced' | 'value' | 'quality' | 'growth' | 'dividend' | 'garp' | 'buffett' | 'graham' | 'lynch' | 'custom'

export type Weights = Record<CategoryKey, number>

export interface Contribution {
  indicatorId: string
  label: string
  category: CategoryKey
  score: number
  /** Points added (+) or removed (−) relative to the neutral baseline of 50. */
  points: number
}

export interface OverallScore {
  mode: InvestorMode
  score: number | null
  weightsUsed: Weights // renormalised over categories with data
  excluded: CategoryKey[]
  categoryContributions: { key: CategoryKey; score: number; weight: number; points: number }[]
  contributions: Contribution[]
  signal: 'Strong' | 'Favourable' | 'Mixed' | 'Weak' | 'Very Weak' | 'Insufficient data'
}

export interface SignalCounts {
  strong_positive: number
  positive: number
  neutral: number
  negative: number
  strong_negative: number
  unavailable: number
}

export function ratingFromScore(score: number | null): Rating {
  if (score === null) return 'unavailable'
  if (score >= 85) return 'strong_positive'
  if (score >= 65) return 'positive'
  if (score >= 45) return 'neutral'
  if (score >= 25) return 'negative'
  return 'strong_negative'
}

export function overallSignal(score: number | null): OverallScore['signal'] {
  if (score === null) return 'Insufficient data'
  if (score >= 80) return 'Strong'
  if (score >= 65) return 'Favourable'
  if (score >= 50) return 'Mixed'
  if (score >= 35) return 'Weak'
  return 'Very Weak'
}
