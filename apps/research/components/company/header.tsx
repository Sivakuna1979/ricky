import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, Bot, FileDown, GitCompare } from 'lucide-react'
import type { CompanyAnalysis } from '@/lib/analysis/build'
import { categoryScore } from '@/lib/scoring/engine'
import { fmtDate, fmtMoney, fmtPct, fmtPrice } from '@/lib/format'
import { ScoreRing } from '@/components/ui/score'
import { SourceTag } from '@/components/ui/source-tag'
import { scoreTone, TONE_TEXT } from '@/components/ui/rating'
import { PrintButton } from './print-button'
import { WatchButton } from './watch-button'

function Mini({ label, score, href, word }: { label: string; score: number | null; href: string; word?: string | null }) {
  const tone = scoreTone(score)
  return (
    <a href={href} className="rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 transition hover:border-ink-500">
      <div className="label">{label}</div>
      <div className="num mt-0.5 text-xl font-semibold text-fg">
        {score ?? '—'}
        <span className="text-xs font-normal text-fg-4">/100</span>
      </div>
      {word && <div className={`text-[11px] font-medium ${TONE_TEXT[tone]}`}>{word}</div>}
    </a>
  )
}

export function CompanyHeader({ a, canReport }: { a: CompanyAnalysis; canReport: boolean }) {
  const { dataset: ds, valuation: v } = a
  const q = ds.quote
  const up = (q.change ?? 0) >= 0
  const cats = a.categories
  return (
    <div className="card card-pad">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{ds.profile.name}</h1>
            {ds.mode === 'demo' && <span className="chip border-neu/50 bg-neu-soft font-semibold uppercase tracking-wider text-neu">Demo data</span>}
          </div>
          <div className="mt-1 text-sm text-fg-3">
            {ds.profile.ticker} • {ds.profile.exchange} · {ds.profile.sector} · {ds.profile.industry} · {ds.profile.currency}
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-1">
            <span className="num text-4xl font-semibold text-fg">{fmtPrice(q.price, ds.profile.currency)}</span>
            {q.change !== null && (
              <span className={`num inline-flex items-center gap-1 pb-1 text-sm font-medium ${up ? 'text-pos' : 'text-neg'}`}>
                {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {up ? '+' : ''}
                {q.change?.toFixed(2)} ({fmtPct(q.changePct, 2, true)})
              </span>
            )}
            <span className="flex items-center gap-2 pb-1 text-xs text-fg-3">
              As of {fmtDate(q.asOf)} <SourceTag source={ds.sources[q.sourceId]} />
            </span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
            {[
              ['Market cap', fmtMoney(v.marketCap, ds.profile.currency)],
              ['Enterprise value', fmtMoney(v.enterpriseValue, ds.profile.currency)],
              ['P/E (FY)', v.pe ? `${v.pe.toFixed(1)}×` : '—'],
              ['FCF yield', fmtPct(v.fcfYield, 2)],
            ].map(([k, val]) => (
              <div key={k}>
                <dt className="text-xs text-fg-3">{k}</dt>
                <dd className="num font-medium text-fg">{val}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex items-center gap-5">
          <ScoreRing score={a.overall.score} size={124} label="Investment Quality" sub={a.overall.signal} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Mini label="Financial health" score={categoryScore(cats, 'financial_strength')} href="#balance-sheet" word={a.labels.balanceSheet} />
        <Mini label="Growth" score={categoryScore(cats, 'growth')} href="#growth" word={a.fp.revenueTrend === 'unknown' ? null : a.fp.revenueTrend[0].toUpperCase() + a.fp.revenueTrend.slice(1)} />
        <Mini label="Valuation" score={categoryScore(cats, 'valuation')} href="#valuation" word={a.labels.valuation} />
        <Mini label="Moat" score={a.moat.score} href="#moat" word={a.moat.rating} />
        <Mini label="Risk (higher = safer)" score={categoryScore(cats, 'risk')} href="#risk" word={a.labels.risk} />
        <Mini label="Data confidence" score={a.confidence.score} href="#data-quality" word={ds.mode === 'demo' ? 'Demo dataset' : null} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <a href="#summary" className="btn btn-primary">
          View full analysis
        </a>
        <WatchButton ticker={ds.profile.ticker} />
        <Link href={`/compare?tickers=${ds.profile.ticker}`} className="btn">
          <GitCompare className="h-4 w-4" /> Compare
        </Link>
        <a href={canReport ? `/api/report/${ds.profile.ticker}` : '/pricing'} className="btn" title={canReport ? 'Download PDF research report' : 'PDF reports are a Premium feature'}>
          <FileDown className="h-4 w-4" /> Export report (PDF)
        </a>
        <PrintButton>Print view</PrintButton>
        <a href="#ask" className="btn">
          <Bot className="h-4 w-4" /> Ask AI
        </a>
      </div>
    </div>
  )
}
