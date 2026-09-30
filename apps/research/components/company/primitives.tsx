import clsx from 'clsx'
import { Database } from 'lucide-react'
import type { ReactNode } from 'react'
import type { CompanyAnalysis } from '@/lib/analysis/build'
import type { YearMetrics } from '@/lib/finance/metrics'
import type { Num } from '@/lib/domain/types'
import type { Indicator } from '@/lib/scoring/types'
import { RatingPill } from '@/components/ui/rating'
import { SourceTag } from '@/components/ui/source-tag'
import { Explain } from '@/components/ui/explain'
import { currencySymbol, NA } from '@/lib/format'

export function Sparkline({ values, width = 88, height = 24 }: { values: Num[]; width?: number; height?: number }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => typeof p.v === 'number' && Number.isFinite(p.v))
  if (pts.length < 2) return <span className="text-xs text-fg-4">—</span>
  const min = Math.min(...pts.map((p) => p.v))
  const max = Math.max(...pts.map((p) => p.v))
  const span = max - min || 1
  const x = (i: number) => (i / (values.length - 1)) * (width - 4) + 2
  const y = (v: number) => height - 2 - ((v - min) / span) * (height - 4)
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  return (
    <svg width={width} height={height} aria-label="10-year trend" role="img">
      <path d={d} fill="none" stroke="#3987e5" strokeWidth={1.5} />
      <circle cx={x(last.i)} cy={y(last.v)} r={2.5} fill="#3987e5" />
    </svg>
  )
}

export function Unavailable({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-ink-600 bg-ink-900/40 p-4">
      <Database className="mt-0.5 h-4 w-4 shrink-0 text-fg-4" aria-hidden />
      <div className="text-sm">
        <div className="font-medium text-fg-2">{title}</div>
        <div className="mt-0.5 text-fg-3">{children ?? 'Data unavailable. Nothing is estimated or invented in its place.'}</div>
      </div>
    </div>
  )
}

/** Scored evidence list for one category — value, score, signal, and the reason. */
export function IndicatorList({ a, indicators }: { a: CompanyAnalysis; indicators: Indicator[] }) {
  const sym = currencySymbol(a.dataset.profile.currency)
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th>Indicator</th>
            <th className="text-right">Value</th>
            <th className="text-right">Score</th>
            <th>Signal</th>
            <th className="min-w-[320px]">Why</th>
          </tr>
        </thead>
        <tbody>
          {indicators.map((i) => (
            <tr key={i.id}>
              <td className="align-top">
                <div className="font-medium text-fg">{i.label}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  {i.glossaryKey && <Explain k={i.glossaryKey} value={i.display} sym={sym} />}
                  {i.qualitative && <span className="chip border-ink-600 text-[10px] text-fg-3">Editorial input</span>}
                  {i.sourceIds[0] && <SourceTag source={a.dataset.sources[i.sourceIds[0]]} />}
                </div>
              </td>
              <td className="num text-right align-top text-fg">{i.display}</td>
              <td className="num text-right align-top">{i.score ?? '—'}</td>
              <td className="align-top">
                <RatingPill rating={i.rating} />
              </td>
              <td className="whitespace-normal align-top text-xs leading-relaxed text-fg-3">
                <div className="text-fg-2">{i.rationale}</div>
                <details className="mt-1">
                  <summary className="cursor-pointer text-fg-4 hover:text-fg-3">How it is scored</summary>
                  <div className="mt-1 text-fg-4">{i.basis}</div>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export interface HistoryRow {
  label: string
  key: keyof YearMetrics
  fmt: (v: Num) => string
  industry?: Num
  peer?: Num
  indicatorId?: string
  glossaryKey?: string
}

/** Current · previous year · 5-yr avg · 10-yr trend · industry · peers · signal. */
export function MetricHistoryTable({ a, rows }: { a: CompanyAnalysis; rows: HistoryRow[] }) {
  const { fp } = a
  const sym = currencySymbol(a.dataset.profile.currency)
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="tbl">
        <thead>
          <tr>
            <th>Metric</th>
            <th className="text-right">Current</th>
            <th className="text-right">Prev. year</th>
            <th className="text-right">5-yr avg</th>
            <th>10-yr trend</th>
            <th className="text-right">Industry</th>
            <th className="text-right">Peer avg</th>
            <th>Signal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const ind = r.indicatorId ? a.indicators.find((i) => i.id === r.indicatorId) : undefined
            return (
              <tr key={r.label}>
                <td>
                  <div className="font-medium text-fg">{r.label}</div>
                  {r.glossaryKey && <Explain k={r.glossaryKey} value={r.fmt(fp.latest[r.key] as Num)} sym={sym} />}
                </td>
                <td className="num text-right font-medium text-fg">{r.fmt(fp.latest[r.key] as Num)}</td>
                <td className="num text-right">{fp.previous ? r.fmt(fp.previous[r.key] as Num) : NA}</td>
                <td className="num text-right">{r.fmt((fp.avg5[r.key] as Num) ?? null)}</td>
                <td>
                  <Sparkline values={fp.years.slice(-10).map((y) => y[r.key] as Num)} />
                </td>
                <td className="num text-right">{r.industry === undefined ? '—' : r.fmt(r.industry)}</td>
                <td className="num text-right">{r.peer === undefined ? '—' : r.fmt(r.peer)}</td>
                <td>{ind ? <RatingPill rating={ind.rating} /> : <span className="text-xs text-fg-4">Context</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function Pill({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'pos' | 'neu' | 'neg' | 'accent' }) {
  return (
    <span
      className={clsx(
        'chip',
        tone === 'pos' && 'border-pos/40 bg-pos-soft text-pos',
        tone === 'neu' && 'border-neu/40 bg-neu-soft text-neu',
        tone === 'neg' && 'border-neg/40 bg-neg-soft text-neg',
        tone === 'accent' && 'border-accent/40 bg-accent-soft text-accent',
        tone === 'default' && 'border-ink-600 text-fg-2',
      )}
    >
      {children}
    </span>
  )
}
