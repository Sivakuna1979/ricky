import Link from 'next/link'
import { ArrowRight, BookOpen, Calculator, FileSearch, Scale, ShieldCheck, Sigma } from 'lucide-react'
import { SearchBox } from '@/components/layout/search-box'
import { ScoreRing, ScoreBar } from '@/components/ui/score'
import { Callout } from '@/components/ui/section'
import { demoDataset, DEMO_UNIVERSE } from '@/lib/providers/demo'
import { buildAnalysis } from '@/lib/analysis/build'
import { toSnapshot } from '@/lib/analysis/snapshot'
import { categoryScore } from '@/lib/scoring/engine'
import { fmtDate, fmtMoney, fmtPct, fmtX } from '@/lib/format'
import type { CompanySnapshot } from '@/lib/domain/types'
import { liveDataEnabled } from '@/lib/data/dataset'

export const revalidate = 3600

const EXAMPLES = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'TSLA']

function ScreenCard({ title, basis, rows, metric }: { title: string; basis: string; rows: CompanySnapshot[]; metric: (c: CompanySnapshot) => string }) {
  return (
    <div className="card card-pad">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-fg">{title}</h3>
        <span className="chip border-neu/40 bg-neu-soft text-[10px] font-semibold uppercase text-neu">Demo</span>
      </div>
      <p className="mt-0.5 text-xs text-fg-3">{basis}</p>
      <ol className="mt-3 divide-y divide-ink-750">
        {rows.map((c, i) => (
          <li key={c.ticker}>
            <Link href={`/company/${c.ticker}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-fg">
              <span className="flex min-w-0 items-center gap-3">
                <span className="num w-4 text-fg-4">{i + 1}</span>
                <span className="font-semibold text-fg">{c.ticker}</span>
                <span className="truncate text-fg-3">{c.name}</span>
              </span>
              <span className="num shrink-0 font-medium text-fg">{metric(c)}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function HomePage() {
  const ds = demoDataset('AAPL')!
  const a = buildAnalysis(ds)!
  const universe = [toSnapshot(a), ...DEMO_UNIVERSE]
  const top = (f: (c: CompanySnapshot) => number | null, n = 5, asc = false) =>
    universe
      .filter((c) => f(c) !== null)
      .sort((x, y) => (asc ? (f(x) as number) - (f(y) as number) : (f(y) as number) - (f(x) as number)))
      .slice(0, n)
  const netCashPct = (c: CompanySnapshot) => (c.netDebt !== null && c.marketCap ? (-c.netDebt / c.marketCap) * 100 : null)
  const qualityRank = (c: CompanySnapshot) => (c.roic !== null && c.operatingMargin !== null ? Math.min(c.roic, 60) + c.operatingMargin : null)

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-ink-700/60">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(76,141,255,0.14),transparent_60%)]" aria-hidden />
        <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-ink-600 bg-ink-900/70 px-3 py-1 text-xs text-fg-2">
            <ShieldCheck className="h-3.5 w-3.5 text-pos" /> Transparent scores · every figure sourced · no black boxes
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-fg sm:text-6xl">Invest With Evidence, Not Emotion.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-fg-2">Deep fundamental analysis, valuation, risk and investor frameworks — explained in one place.</p>
          <div className="mx-auto mt-8 max-w-2xl text-left">
            <SearchBox size="lg" />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-fg-3">Try</span>
            {EXAMPLES.map((t) => (
              <Link key={t} href={`/company/${t}`} className="chip border-ink-600 bg-ink-900/60 text-fg-2 hover:border-accent/50 hover:text-fg">
                {t}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] space-y-10 px-4 py-10 sm:px-6">
        {!liveDataEnabled() && (
          <Callout tone="demo" title="Demo mode">
            No live market-data provider is connected. Apple (AAPL) runs end-to-end on an illustrative demo dataset; other companies show demo snapshot metrics only. All demo figures are labelled — none should be
            read as current or verified data.
          </Callout>
        )}

        {/* Market overview */}
        <section aria-labelledby="mkt-h">
          <div className="mb-3 flex items-end justify-between">
            <h2 id="mkt-h" className="text-lg font-semibold text-fg">
              Market overview
            </h2>
            <span className="text-xs text-fg-3">Index data requires a market-data provider</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {['S&P 500', 'NASDAQ Composite', 'Dow Jones', 'FTSE 100', 'US 10Y yield', 'VIX'].map((n) => (
              <div key={n} className="card p-4">
                <div className="label">{n}</div>
                <div className="num mt-1 text-lg font-semibold text-fg-4">—</div>
                <div className="text-xs text-fg-4">Data unavailable</div>
              </div>
            ))}
          </div>
        </section>

        {/* Featured analysis */}
        <section className="card card-pad" aria-labelledby="feat-h">
          <div className="grid gap-8 lg:grid-cols-[auto_1fr_auto] lg:items-center">
            <ScoreRing score={a.overall.score} size={132} label="Investment Quality" sub={a.overall.signal} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="feat-h" className="text-xl font-semibold text-fg">
                  Apple Inc. <span className="text-fg-3">· AAPL · NASDAQ</span>
                </h2>
                <span className="chip border-neu/40 bg-neu-soft text-[10px] font-semibold uppercase text-neu">Demo data</span>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-fg-3">
                The full research dashboard: {a.indicators.length} scored indicators, six investor frameworks, an editable DCF, bear/base/bull scenarios and a {a.checklist.items.length}-point checklist — each
                with its formula and source.
              </p>
              <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-3">
                <ScoreBar label="Financial strength" score={categoryScore(a.categories, 'financial_strength')} />
                <ScoreBar label="Moat" score={a.moat.score} />
                <ScoreBar label="Growth" score={categoryScore(a.categories, 'growth')} />
                <ScoreBar label="Profitability" score={categoryScore(a.categories, 'profitability')} />
                <ScoreBar label="Valuation" score={categoryScore(a.categories, 'valuation')} />
                <ScoreBar label="Risk (higher = safer)" score={categoryScore(a.categories, 'risk')} />
              </div>
            </div>
            <Link href="/company/AAPL" className="btn btn-primary justify-center">
              Open full analysis <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Screens */}
        <section aria-labelledby="screens-h">
          <div className="mb-3">
            <h2 id="screens-h" className="text-lg font-semibold text-fg">
              Screens
            </h2>
            <p className="text-sm text-fg-3">Simple, transparent rankings of the demo universe — starting points for research, never a list of winners.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ScreenCard title="Top quality metrics" basis="Ranked by ROIC (capped at 60%) + operating margin" rows={top(qualityRank)} metric={(c) => `${fmtPct(c.roic, 0)} · ${fmtPct(c.operatingMargin, 0)}`} />
            <ScreenCard title="Potential value opportunities" basis="Highest free-cash-flow yield. Cheap can be cheap for a reason." rows={top((c) => c.fcfYield)} metric={(c) => fmtPct(c.fcfYield, 1)} />
            <ScreenCard title="Highest ROIC" basis="Return on invested capital, latest year" rows={top((c) => c.roic)} metric={(c) => fmtPct(c.roic, 0)} />
            <ScreenCard title="Strongest balance sheets" basis="Net cash as % of market cap (negative = net debt)" rows={top(netCashPct)} metric={(c) => fmtPct(netCashPct(c), 1)} />
            <ScreenCard title="Fastest growing" basis="Revenue growth, latest year" rows={top((c) => c.revenueGrowth)} metric={(c) => fmtPct(c.revenueGrowth, 0, true)} />
            <ScreenCard title="Lowest EV/EBITDA" basis="Enterprise value ÷ EBITDA" rows={top((c) => c.evToEbitda, 5, true)} metric={(c) => fmtX(c.evToEbitda)} />
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent earnings */}
          <section className="card card-pad" aria-labelledby="earn-h">
            <div className="flex items-center justify-between">
              <h2 id="earn-h" className="font-semibold text-fg">
                Recent earnings
              </h2>
              <span className="chip border-neu/40 bg-neu-soft text-[10px] font-semibold uppercase text-neu">Demo</span>
            </div>
            <ul className="mt-3 divide-y divide-ink-750">
              {ds.earnings
                .slice(-4)
                .reverse()
                .map((e) => (
                  <li key={e.period} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      <span className="font-semibold text-fg">AAPL</span> <span className="text-fg-3">{e.period}</span>
                      <span className="block text-xs text-fg-4">{fmtDate(e.reportDate)}</span>
                    </span>
                    <span className="num text-right text-fg-2">
                      EPS ${e.epsActual?.toFixed(2)} vs ${e.epsEstimate?.toFixed(2)} est.
                      <span className="block text-xs text-fg-4">Revenue {fmtMoney(e.revenueActual)}</span>
                    </span>
                  </li>
                ))}
            </ul>
          </section>
          {/* Popular research */}
          <section className="card card-pad" aria-labelledby="pop-h">
            <h2 id="pop-h" className="font-semibold text-fg">
              Popular research
            </h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {universe.slice(0, 8).map((c) => (
                <li key={c.ticker}>
                  <Link href={`/company/${c.ticker}`} className="flex items-center justify-between rounded-lg border border-ink-700 px-3 py-2 text-sm hover:border-accent/50">
                    <span>
                      <span className="font-semibold text-fg">{c.ticker}</span> <span className="text-fg-3">{c.name.split(/[ ,.]/)[0]}</span>
                    </span>
                    <span className="text-xs text-fg-4">{c.ticker === 'AAPL' ? 'Full analysis' : 'Snapshot'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* How it works */}
        <section aria-labelledby="how-h">
          <h2 id="how-h" className="mb-4 text-lg font-semibold text-fg">
            How the analysis works
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { Icon: FileSearch, t: 'Sourced data', d: 'Every figure carries its source, reporting period and update date. Missing data is shown as unavailable — never invented.' },
              { Icon: Sigma, t: 'Deterministic scores', d: 'ROIC, P/E, FCF yield, CAGR and 80+ indicators are calculated in code and scored by published curves.' },
              { Icon: Scale, t: 'Both sides of the case', d: 'Strengths and risks come from the same evidence. Bull and bear cases are modelled, not predicted.' },
              { Icon: Calculator, t: 'Your assumptions', d: 'Change the investor mode, reweight categories or edit the DCF — and see exactly how the answer moves.' },
            ].map(({ Icon, t, d }) => (
              <div key={t} className="card card-pad">
                <Icon className="h-5 w-5 text-accent" />
                <h3 className="mt-3 font-semibold text-fg">{t}</h3>
                <p className="mt-1 text-sm text-fg-3">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card card-pad flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 text-accent" />
            <div>
              <h2 className="font-semibold text-fg">New to investing research?</h2>
              <p className="text-sm text-fg-3">Every metric has an “Explain simply” button. The Investment Academy covers statements, valuation, moats and investor psychology in plain language.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/academy" className="btn">
              Investment Academy
            </Link>
            <Link href="/methodology" className="btn">
              Scoring methodology
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
