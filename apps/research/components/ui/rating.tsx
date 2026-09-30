import { AlertTriangle, CheckCircle2, CircleDashed, MinusCircle, XCircle } from 'lucide-react'
import clsx from 'clsx'
import type { Rating } from '@/lib/scoring/types'

export const RATING_META: Record<Rating, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  strong_positive: { label: 'Strong positive', cls: 'border-pos/40 bg-pos-soft text-pos', Icon: CheckCircle2 },
  positive: { label: 'Positive', cls: 'border-pos/30 bg-pos-soft text-pos', Icon: CheckCircle2 },
  neutral: { label: 'Neutral', cls: 'border-neu/30 bg-neu-soft text-neu', Icon: MinusCircle },
  negative: { label: 'Negative', cls: 'border-neg/30 bg-neg-soft text-neg', Icon: AlertTriangle },
  strong_negative: { label: 'Strong negative', cls: 'border-neg/40 bg-neg-soft text-neg', Icon: XCircle },
  unavailable: { label: 'No data', cls: 'border-ink-600 bg-ink-800 text-fg-3', Icon: CircleDashed },
}

export function RatingPill({ rating, compact = false }: { rating: Rating; compact?: boolean }) {
  const m = RATING_META[rating]
  return (
    <span className={clsx('chip whitespace-nowrap', m.cls)} title={m.label}>
      <m.Icon className="h-3.5 w-3.5" aria-hidden />
      {compact ? <span className="sr-only">{m.label}</span> : m.label}
    </span>
  )
}

/** Tone for a 0–100 score: always rendered together with the number and a word. */
export function scoreTone(score: number | null): 'pos' | 'neu' | 'neg' | 'na' {
  if (score === null) return 'na'
  if (score >= 65) return 'pos'
  if (score >= 45) return 'neu'
  return 'neg'
}

export const TONE_TEXT = { pos: 'text-pos', neu: 'text-neu', neg: 'text-neg', na: 'text-fg-3' }
export const TONE_BG = { pos: 'bg-pos', neu: 'bg-neu', neg: 'bg-neg', na: 'bg-ink-600' }
export const TONE_WORD = { pos: 'Positive', neu: 'Neutral', neg: 'Negative', na: 'No data' }
