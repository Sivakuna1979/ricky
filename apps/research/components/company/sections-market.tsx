import clsx from 'clsx'
import { ExternalLink } from 'lucide-react'
import type { CompanyAnalysis } from '@/lib/analysis/build'
import { riskLabel } from '@/lib/scoring/indicators'
import { currencySymbol, fmtDate, fmtMoney, fmtPct, fmtPrice } from '@/lib/format'
import { Section, Stat, Callout } from '@/components/ui/section'
import { SourceTag } from '@/components/ui/source-tag'
import { PriceChart } from '@/components/charts/price-chart'
import { IndicatorList, Pill, Unavailable } from './primitives'

const LEVEL = ['', 'LOW', 'MODERATE', 'ELEVATED', 'HIGH'] as const
const LEVEL_TONE = ['default', 'pos', 'neu', 'neg', 'neg'] as const

export function Risk({ a }: { a: CompanyAnalysis }) {
  const c = a.categories.find((x) => x.key === 'risk')!
  const q = a.dataset.qualitative
  return (
    <Section
      id="risk"
      kicker={`Risk analysis · Risk score ${c.score ?? '—'}/100 (higher = lower risk)`}
      title="What could go wrong?"
      actions={a.labels.risk && <Pill tone={a.labels.risk === 'LOW' ? 'pos' : a.labels.risk === 'MODERATE' ? 'neu' : 'neg'}>Overall risk: {a.labels.risk}</Pill>}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-fg">Top 5 risks</h3>
          <ol className="space-y-3">
            {a.topRisks.map((r, i) => (
              <li key={r.id} className="flex gap-3 rounded-lg border border-neg/20 bg-neg-soft p-3">
                <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neg/20 text-xs font-semibold text-neg">{i + 1}</span>
                <div className="text-sm">
                  <div className="font-medium text-fg">
                    {r.label} <span className="text-xs text-fg-3">· {r.display}</span>
                  </div>
                  <div className="text-xs text-fg-2">{r.rationale}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-fg">Risk matrix</h3>
          {q ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {q.risks.map((r) => (
                <div key={r.key} className="rounded-lg border border-ink-700 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-fg">{riskLabel(r.key)}</span>
                    <Pill tone={LEVEL_TONE[r.level]}>{LEVEL[r.level]}</Pill>
                  </div>
                  <p className="mt-1 text-xs text-fg-3">{r.evidence}</p>
                </div>
              ))}
            </div>
          ) : (
            <Unavailable title="Qualitative risk matrix">Requires a reviewed editorial profile (from 10-K risk factors).</Unavailable>
          )}
        </div>
      </div>
      <div className="mt-6">
        <IndicatorList a={a} indicators={c.indicators} />
      </div>
    </Section>
  )
}

export function Technical({ a }: { a: CompanyAnalysis }) {
  const t = a.technical
  const c = a.categories.find((x) => x.key === 'technical')!
  const sym = currencySymbol(a.dataset.profile.currency)
  const w = a.overall.weightsUsed.technical
  return (
    <Section
      id="technical"
      kicker={`Market / technical conditions · score ${c.score ?? '—'}/100 · weight ${w.toFixed(1)}%`}
      title="Price trend and momentum"
      description="Deliberately a small weight: short-term price action should not drive a long-term assessment."
    >
      {a.dataset.pricesSynthetic && (
        <div className="mb-4">
          <Callout tone="demo" title="Synthetic price series">
            No price provider is connected. The chart and indicators below run on a synthetic series generated in code (anchored to demo fiscal-year prices) purely to demonstrate the calculations. It is not
            AAPL’s actual trading history.
          </Callout>
        </div>
      )}
      <PriceChart prices={a.chartPrices} sym={sym} synthetic={a.dataset.pricesSynthetic} />
      {t ? (
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          <Stat label="Price" value={fmtPrice(t.price)} />
          <Stat label="52-wk high" value={fmtPrice(t.high52)} />
          <Stat label="52-wk low" value={fmtPrice(t.low52)} />
          <Stat label="50-day MA" value={fmtPrice(t.sma50)} />
          <Stat label="100-day MA" value={fmtPrice(t.sma100)} />
          <Stat label="200-day MA" value={fmtPrice(t.sma200)} />
          <Stat label="RSI (14)" value={t.rsi14?.toFixed(0) ?? '—'} sub={t.rsi14 && t.rsi14 > 70 ? 'Overbought zone' : t.rsi14 && t.rsi14 < 30 ? 'Oversold zone' : 'Neutral zone'} />
          <Stat label="MACD" value={t.macd?.toFixed(2) ?? '—'} sub={`Signal ${t.macdSignal?.toFixed(2) ?? '—'}`} />
          <Stat label="Support (3-mo low)" value={fmtPrice(t.support)} />
          <Stat label="Resistance (3-mo high)" value={fmtPrice(t.resistance)} />
          <Stat label="Momentum 6m / 12m" value={`${fmtPct(t.return6m, 0, true)} / ${fmtPct(t.return12m, 0, true)}`} />
          <Stat label="Volume vs 50-day avg" value={t.lastVolume && t.avgVolume50 ? `${((t.lastVolume / t.avgVolume50) * 100).toFixed(0)}%` : '—'} />
        </div>
      ) : (
        <Unavailable title="Technical indicators">Requires at least 60 days of price history.</Unavailable>
      )}
      <div className="mt-6">
        <IndicatorList a={a} indicators={c.indicators} />
      </div>
    </Section>
  )
}

export function Analysts({ a }: { a: CompanyAnalysis }) {
  const e = a.dataset.estimates
  const sym = currencySymbol(a.dataset.profile.currency)
  const price = a.valuation.price
  const range = e && e.targetLow !== null && e.targetHigh !== null ? [e.targetLow, e.targetHigh] : null
  const pos = (v: number | null) => (range && v !== null ? `${Math.min(100, Math.max(0, ((v - range[0]) / (range[1] - range[0])) * 100))}%` : '0%')
  return (
    <Section id="analysts" kicker="Analyst expectations" title="What third-party analysts expect" description="These are third-party analyst estimates, not the platform’s prediction. They are excluded from the Investment Quality Score except as forward-growth context." actions={e && <SourceTag source={a.dataset.sources[e.sourceId]} />}>
      {e ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Low" value={fmtPrice(e.targetLow)} />
              <Stat label="Median" value={fmtPrice(e.targetMedian)} />
              <Stat label="Average" value={fmtPrice(e.targetMean)} />
              <Stat label="High" value={fmtPrice(e.targetHigh)} />
            </div>
            {range && (
              <div className="mt-6">
                <div className="relative h-2 rounded-full bg-ink-700">
                  <div className="absolute -top-1 h-4 w-0.5 bg-fg-3" style={{ left: pos(e.targetMedian) }} title="Median target" />
                  <div className="absolute -top-1.5 h-5 w-1 rounded bg-accent" style={{ left: pos(price) }} title="Current price" />
                </div>
                <div className="mt-2 flex justify-between text-xs text-fg-3">
                  <span>{fmtPrice(range[0])}</span>
                  <span>
                    <span className="text-accent">▮</span> current {fmtPrice(price)} · <span className="text-fg-3">|</span> median target
                  </span>
                  <span>{fmtPrice(range[1])}</span>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Analysts covering" value={e.analystCount ?? '—'} />
            <Stat label="Revenue est. next FY" value={fmtMoney(e.revenueNextFY)} />
            <Stat label="EPS est. next FY" value={e.epsNextFY ? `${sym}${e.epsNextFY.toFixed(2)}` : '—'} />
            <Stat label="EPS est. FY+2" value={e.epsNextFY2 ? `${sym}${e.epsNextFY2.toFixed(2)}` : '—'} />
          </div>
        </div>
      ) : (
        <Unavailable title="Analyst estimates">Connect an estimates provider.</Unavailable>
      )}
    </Section>
  )
}

export function Earnings({ a }: { a: CompanyAnalysis }) {
  const rows = a.dataset.earnings
  const sym = currencySymbol(a.dataset.profile.currency)
  const verdict = (act: number | null, est: number | null, tol: number) => {
    if (act === null || est === null || est === 0) return null
    const s = (act - est) / Math.abs(est)
    return { s: s * 100, label: s > tol ? 'Beat' : s < -tol ? 'Missed' : 'Met' }
  }
  const eps = rows.map((r) => verdict(r.epsActual, r.epsEstimate, 0.005))
  const beats = eps.filter((v) => v?.label === 'Beat').length
  return (
    <Section id="earnings" kicker="Earnings analysis" title={`Last ${rows.length} quarters: actual vs estimate`} description={rows.length ? `EPS beat estimates in ${beats} of ${rows.length} quarters. Consistent small beats are common and partly reflect conservative guidance.` : undefined}>
      {rows.length ? (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Quarter</th>
                <th>Reported</th>
                <th className="text-right">EPS actual</th>
                <th className="text-right">EPS est.</th>
                <th>EPS</th>
                <th className="text-right">Revenue actual</th>
                <th className="text-right">Revenue est.</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const rv = verdict(r.revenueActual, r.revenueEstimate, 0.005)
                const tag = (v: ReturnType<typeof verdict>) =>
                  v ? (
                    <span className={clsx('chip', v.label === 'Beat' ? 'border-pos/40 text-pos' : v.label === 'Missed' ? 'border-neg/40 text-neg' : 'border-neu/40 text-neu')}>
                      {v.label} {v.s >= 0 ? '+' : ''}
                      {v.s.toFixed(1)}%
                    </span>
                  ) : (
                    '—'
                  )
                return (
                  <tr key={r.period}>
                    <td className="text-fg">{r.period}</td>
                    <td>{fmtDate(r.reportDate)}</td>
                    <td className="num text-right text-fg">{r.epsActual === null ? '—' : `${sym}${r.epsActual.toFixed(2)}`}</td>
                    <td className="num text-right">{r.epsEstimate === null ? '—' : `${sym}${r.epsEstimate.toFixed(2)}`}</td>
                    <td>{tag(eps[i])}</td>
                    <td className="num text-right text-fg">{fmtMoney(r.revenueActual)}</td>
                    <td className="num text-right">{fmtMoney(r.revenueEstimate)}</td>
                    <td>{tag(rv)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-2 flex items-center gap-2 text-xs text-fg-4">
            Forward guidance and transcript analysis arrive with the AI filings module. <SourceTag source={a.dataset.sources['demo-earn'] ?? a.dataset.sources[a.dataset.quote.sourceId]} />
          </p>
        </div>
      ) : (
        <Unavailable title="Quarterly earnings">Connect an earnings provider.</Unavailable>
      )}
    </Section>
  )
}

export function Filings({ a }: { a: CompanyAnalysis }) {
  const f = a.dataset.filings
  return (
    <Section
      id="filings"
      kicker="SEC / regulatory filings"
      title="Primary sources"
      description="Always read the original. AI summaries of 10-K, 10-Q, 8-K, DEF 14A and Form 4 filings (risks, debt, buybacks, legal proceedings) will link every statement back to the filing section it came from."
    >
      {f.length ? (
        <ul className="grid gap-2 md:grid-cols-2">
          {f.map((x) => (
            <li key={x.url}>
              <a href={x.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-ink-700 px-3 py-2.5 transition hover:border-accent/50">
                <span>
                  <span className="font-semibold text-fg">{x.form}</span> <span className="text-sm text-fg-2">— {x.description}</span>
                  <span className="block text-xs text-fg-4">{x.filedAt ? `Filed ${fmtDate(x.filedAt)}` : 'Opens the EDGAR filing index'}</span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-fg-3" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <Unavailable title="Filings">Set SEC_USER_AGENT to enable the SEC EDGAR adapter.</Unavailable>
      )}
    </Section>
  )
}

export function News({ a }: { a: CompanyAnalysis }) {
  void a
  return (
    <Section id="news" kicker="News & market sentiment" title="Sentiment" description="News sentiment ≠ business fundamentals. Sentiment carries at most 2.5% of the default score.">
      <div className="grid gap-4 md:grid-cols-2">
        <Unavailable title="News sentiment (Very Negative → Very Positive)">Requires a news provider. Headlines will be classified by a model, displayed with their source links, and kept separate from the fundamental analysis.</Unavailable>
        <Unavailable title="Analyst rating changes & transcript tone">Requires estimate-revision history and earnings-call transcripts.</Unavailable>
      </div>
    </Section>
  )
}
