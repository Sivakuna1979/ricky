import clsx from 'clsx'
import { scoreTone, TONE_BG, TONE_TEXT } from './rating'

const STROKE = { pos: '#2fbf71', neu: '#f0a93b', neg: '#ef5b5b', na: '#3b4d73' }

export function ScoreRing({ score, size = 112, label, sub }: { score: number | null; size?: number; label?: string; sub?: string }) {
  const tone = scoreTone(score)
  const r = size / 2 - 8
  const c = 2 * Math.PI * r
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1d2a45" strokeWidth={8} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={STROKE[tone]} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="num text-3xl font-semibold text-fg" style={{ fontSize: size / 3.6 }}>
            {score ?? '—'}
          </span>
          <span className="text-[11px] text-fg-3">/ 100</span>
        </div>
      </div>
      {label && <div className="text-center text-xs font-medium text-fg-2">{label}</div>}
      {sub && <div className={clsx('text-center text-xs font-semibold', TONE_TEXT[tone])}>{sub}</div>}
    </div>
  )
}

export function ScoreBar({ label, score, hint, href }: { label: string; score: number | null; hint?: string; href?: string }) {
  const tone = scoreTone(score)
  const inner = (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-fg-2">{label}</span>
        <span className="num text-sm font-semibold text-fg">
          {score ?? '—'}
          <span className="text-fg-4">/100</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
        <div className={clsx('h-full rounded-full', TONE_BG[tone])} style={{ width: `${score ?? 0}%` }} />
      </div>
      {hint && <div className="mt-1 text-xs text-fg-3">{hint}</div>}
    </>
  )
  return href ? (
    <a href={href} className="block rounded-lg p-2 -m-2 transition hover:bg-ink-800">
      {inner}
    </a>
  ) : (
    <div>{inner}</div>
  )
}

/** Text block bar for the final summary — "█████████░ 90". */
export function BlockBar({ score }: { score: number | null }) {
  const n = score === null ? 0 : Math.round(score / 10)
  const tone = scoreTone(score)
  return (
    <span className="num font-mono text-sm tracking-tight" aria-label={`${score ?? 'no data'} out of 100`}>
      <span className={TONE_TEXT[tone]}>{'█'.repeat(n)}</span>
      <span className="text-ink-600">{'░'.repeat(10 - n)}</span>
    </span>
  )
}
