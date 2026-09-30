import Link from 'next/link'
import { getUniverse, type UniverseRow } from '@/lib/screener/universe'
import { readField, type NumericField } from '@/lib/screener/filters'
import { getViewer } from '@/lib/auth/viewer'
import { hasFeature } from '@/lib/plans'
import { TickerPicker } from '@/components/compare/ticker-picker'
import { Callout } from '@/components/ui/section'
import { ScoreRing } from '@/components/ui/score'
import { formatValue } from '@/lib/format-value'
import { LockedCard } from '@/components/ui/locked'

export const metadata = { title: 'Compare companies' }
export const dynamic = 'force-dynamic'

const COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#9085e9']

const METRICS: { key: NumericField; label: string; better: 'high' | 'low'; fmt: (v: number) => string }[] = [
  { key: 'marketCap', label: 'Market cap', better: 'high', fmt: (v) => formatValue(v * 1e9, 'money') },
  { key: 'revenueGrowth', label: 'Revenue growth', better: 'high', fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'epsGrowth', label: 'EPS growth', better: 'high', fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'grossMargin', label: 'Gross margin', better: 'high', fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'operatingMargin', label: 'Operating margin', better: 'high', fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'netMargin', label: 'Net margin', better: 'high', fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'roic', label: 'ROIC', better: 'high', fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'roe', label: 'ROE', better: 'high', fmt: (v) => `${v.toFixed(1)}%` },
  { key: 'fcf', label: 'Free cash flow', better: 'high', fmt: (v) => formatValue(v * 1e9, 'money') },
  { key: 'debtToEquity', label: 'Debt / equity', better: 'low', fmt: (v) => `${v.toFixed(2)}×` },
  { key: 'pe', label: 'P/E', better: 'low', fmt: (v) => `${v.toFixed(1)}×` },
  { key: 'forwardPe', label: 'Forward P/E', better: 'low', fmt: (v) => `${v.toFixed(1)}×` },
  { key: 'peg', label: 'PEG', better: 'low', fmt: (v) => `${v.toFixed(2)}×` },
  { key: 'evToEbitda', label: 'EV / EBITDA', better: 'low', fmt: (v) => `${v.toFixed(1)}×` },
  { key: 'fcfYield', label: 'FCF yield', better: 'high', fmt: (v) => `${v.toFixed(2)}%` },
  { key: 'dividendYield', label: 'Dividend yield', better: 'high', fmt: (v) => `${v.toFixed(2)}%` },
]

const SCORES: { key: NumericField; label: string }[] = [
  { key: 'score.overall', label: 'Quality score (overall)' },
  { key: 'score.quality', label: 'Business quality' },
  { key: 'score.financial', label: 'Financial strength' },
  { key: 'score.growth', label: 'Growth' },
  { key: 'score.valuation', label: 'Valuation' },
  { key: 'score.risk', label: 'Risk (higher = safer)' },
]

function Bars({ rows, metric }: { rows: (UniverseRow | undefined)[]; metric: (typeof METRICS)[number] | { key: NumericField; label: string; fmt: (v: number) => string } }) {
  const vals = rows.map((r) => (r ? readField(r, metric.key) : null))
  const max = Math.max(...vals.map((v) => Math.abs(v ?? 0)), 1e-9)
  return (
    <div className="rounded-lg border border-ink-700 p-3">
      <div className="mb-2 text-sm font-medium text-fg">{metric.label}</div>
      <ul className="space-y-1.5">
        {rows.map((r, i) => {
          const v = vals[i]
          return (
            <li key={i} className="grid grid-cols-[52px_1fr_64px] items-center gap-2 text-xs">
              <span className="font-semibold text-fg-2">{r?.ticker ?? '—'}</span>
              <span className="h-2 rounded-full bg-ink-750">
                {v !== null && <span className="block h-2 rounded-full" style={{ width: `${(Math.abs(v) / max) * 100}%`, background: COLORS[i] }} />}
              </span>
              <span className="num text-right text-fg">{v === null ? '—' : metric.fmt(v)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default async function ComparePage({ searchParams }: { searchParams: { tickers?: string } }) {
  const viewer = await getViewer()
  const universe = getUniverse()
  const tickers = [...new Set((searchParams.tickers ?? 'AAPL,MSFT,GOOGL,AMZN,META').split(',').map((t) => t.trim().toUpperCase()).filter((t) => /^[A-Z0-9.\-]{1,10}$/.test(t)))].slice(0, 5)
  const rows = tickers.map((t) => universe.find((u) => u.ticker === t))
  if (!hasFeature(viewer.plan, 'compare'))
    return (
      <div className="mx-auto max-w-3xl px-4 py-14">
        <LockedCard feature="compare" title="Company comparison" />
      </div>
    )
  return (
    <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <div>
          <div className="label">Compare</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">Side-by-side comparison</h1>
          <p className="mt-1 text-sm text-fg-3">Same methodology, same curves, up to five companies. Colours identify companies consistently across every chart.</p>
        </div>
        <TickerPicker tickers={tickers} options={universe.map((u) => ({ ticker: u.ticker, name: u.name }))} />
      </header>
      <Callout tone="demo">Comparison uses demo data. Only AAPL has a full Investment Quality Score; others show snapshot scores (the same curves on headline metrics).</Callout>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {tickers.map((t, i) => {
          const r = rows[i]
          return (
            <div key={t} className="card card-pad flex flex-col items-center gap-2 text-center" style={{ borderTop: `3px solid ${COLORS[i]}` }}>
              <Link href={`/company/${t}`} className="font-semibold text-fg hover:text-accent">
                {t}
              </Link>
              <div className="truncate text-xs text-fg-3">{r?.name ?? 'Not in dataset'}</div>
              <ScoreRing score={r?.scores.overall ?? null} size={96} />
              <span className="text-[11px] text-fg-4">{r ? (r.scores.kind === 'full' ? 'Full Investment Quality Score' : `Snapshot score · ${r.scores.metricsUsed} metrics`) : 'Data unavailable'}</span>
            </div>
          )
        })}
      </div>

      <section className="card card-pad">
        <h2 className="mb-3 font-semibold text-fg">Scores</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {SCORES.map((s) => (
            <Bars key={s.key} rows={rows} metric={{ ...s, fmt: (v: number) => `${Math.round(v)}` }} />
          ))}
        </div>
      </section>

      <section className="card card-pad">
        <h2 className="mb-3 font-semibold text-fg">Fundamentals & valuation</h2>
        <div className="scrollbar-thin overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Metric</th>
                {tickers.map((t, i) => (
                  <th key={t} className="text-right" style={{ color: COLORS[i] }}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => {
                const vals = rows.map((r) => (r ? readField(r, m.key) : null))
                const present = vals.filter((v): v is number => v !== null)
                const best = present.length > 1 ? (m.better === 'high' ? Math.max(...present) : Math.min(...present.filter((v) => v > 0))) : null
                return (
                  <tr key={m.key}>
                    <td className="text-fg">
                      {m.label} <span className="text-[10px] text-fg-4">{m.better === 'high' ? '(higher is better)' : '(lower is cheaper/safer)'}</span>
                    </td>
                    {vals.map((v, i) => (
                      <td key={i} className={`num text-right ${v !== null && v === best ? 'font-semibold text-fg underline decoration-accent decoration-2 underline-offset-4' : ''}`}>
                        {v === null ? '—' : m.fmt(v)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-fg-4">Underlined = best in row. “Best” is a single-metric observation, not a verdict.</p>
      </section>

      <section className="card card-pad">
        <h2 className="mb-3 font-semibold text-fg">Visual comparison</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {METRICS.filter((m) => ['revenueGrowth', 'operatingMargin', 'roic', 'fcfYield', 'pe', 'evToEbitda', 'debtToEquity', 'grossMargin'].includes(m.key)).map((m) => (
            <Bars key={m.key} rows={rows} metric={m} />
          ))}
        </div>
      </section>
    </div>
  )
}
