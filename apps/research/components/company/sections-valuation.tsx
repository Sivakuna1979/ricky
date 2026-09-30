import type { CompanyAnalysis } from '@/lib/analysis/build'
import { currencySymbol, fmtMoney, fmtPct, fmtPrice, fmtX } from '@/lib/format'
import { Section, Callout, Stat } from '@/components/ui/section'
import { AnnualChart } from '@/components/charts/annual-chart'
import { IndicatorList, Pill } from './primitives'
import { DcfCalculator } from './dcf-calculator'
import { CompoundingCalculator } from './compounding-calculator'
import { Explain } from '@/components/ui/explain'

export function Valuation({ a }: { a: CompanyAnalysis }) {
  const c = a.categories.find((x) => x.key === 'valuation')!
  const sym = currencySymbol(a.dataset.profile.currency)
  const tone = (c.score ?? 50) >= 65 ? 'pos' : (c.score ?? 50) >= 50 ? 'accent' : (c.score ?? 50) >= 38 ? 'neu' : 'neg'
  const fmt = (k: string, v: number | null) => (k.includes('Yield') || k === 'fcfYield' || k === 'earningsYield' || k === 'dividendYield' ? fmtPct(v, 2) : fmtX(v, k === 'peg' ? 2 : 1))
  return (
    <Section
      id="valuation"
      kicker={`Valuation · score ${c.score ?? '—'}/100`}
      title="Is the valuation demanding?"
      description="The verdict combines several multiples against the company’s own history, its industry and its peers — never a single ratio."
      actions={a.labels.valuation && <Pill tone={tone}>{a.labels.valuation}</Pill>}
    >
      <div className="scrollbar-thin overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Multiple</th>
              <th className="text-right">Current</th>
              <th className="text-right">5-yr avg</th>
              <th className="text-right">10-yr avg</th>
              <th className="text-right">Industry median</th>
              <th className="text-right">Peer median</th>
              <th className="text-right">vs references</th>
            </tr>
          </thead>
          <tbody>
            {a.multiples.map((m) => (
              <tr key={m.key}>
                <td>
                  <div className="text-fg">{m.label}</div>
                  <Explain k={m.key} value={fmt(m.key, m.current)} sym={sym} />
                </td>
                <td className="num text-right font-medium text-fg">{fmt(m.key, m.current)}</td>
                <td className="num text-right">{m.avg5 === null ? '—' : fmt(m.key, m.avg5)}</td>
                <td className="num text-right">{m.avg10 === null ? '—' : fmt(m.key, m.avg10)}</td>
                <td className="num text-right">{m.industry === null ? '—' : fmt(m.key, m.industry)}</td>
                <td className="num text-right">{m.peerMedian === null ? '—' : fmt(m.key, m.peerMedian)}</td>
                <td className={`num text-right font-medium ${m.premiumPct === null ? 'text-fg-4' : m.premiumPct > 15 ? 'text-neg' : m.premiumPct < -15 ? 'text-pos' : 'text-neu'}`}>
                  {m.premiumPct === null ? '—' : `${m.premiumPct >= 0 ? '+' : ''}${m.premiumPct.toFixed(0)}% ${m.premiumPct >= 0 ? 'premium' : 'discount'}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-fg-4">
        Historical multiples use fiscal-year-end prices{a.dataset.mode === 'demo' ? ' from the demo dataset' : ''}. PEG growth basis: {a.valuation.pegGrowthBasis}. Yields: a positive premium means the yield is lower (more
        expensive) than references.
      </p>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AnnualChart
          title="P/E and P/FCF at each fiscal year-end"
          format="num"
          data={a.dataset.annual.map((y, i) => ({ label: `FY${String(y.fiscalYear).slice(2)}`, pe: a.fp.years[i].pe, pfcf: a.fp.years[i].pfcf }))}
          series={[
            { key: 'pe', label: 'P/E', color: '#3987e5', kind: 'line' },
            { key: 'pfcf', label: 'P/FCF', color: '#d95926', kind: 'line' },
          ]}
        />
        <div className="grid content-start grid-cols-2 gap-3">
          <Stat label="Enterprise value" value={fmtMoney(a.valuation.enterpriseValue)} />
          <Stat label="Earnings yield (EPS/price)" value={fmtPct(a.valuation.peEarningsYield, 2)} />
          <Stat label="FCF yield" value={fmtPct(a.valuation.fcfYield, 2)} />
          <Stat label="Dividend yield" value={fmtPct(a.valuation.dividendYield, 2)} />
          <Stat label="PEG" value={fmtX(a.valuation.peg, 2)} />
          <Stat label="Price / book" value={fmtX(a.valuation.pb)} sub="Less meaningful for asset-light firms" />
        </div>
      </div>
      <div className="mt-6">
        <IndicatorList a={a} indicators={c.indicators} />
      </div>
    </Section>
  )
}

export function Dcf({ a }: { a: CompanyAnalysis }) {
  const sym = currencySymbol(a.dataset.profile.currency)
  if (!a.dcf.length || a.valuation.price === null)
    return (
      <Section id="dcf" kicker="Discounted cash flow" title="DCF valuation">
        <Callout>A DCF needs positive free cash flow, share count, net debt and a price. One or more of these is unavailable.</Callout>
      </Section>
    )
  return (
    <Section
      id="dcf"
      kicker="Discounted cash flow · interactive"
      title="What would you have to believe?"
      description={
        <>
          Edit any assumption; every output recalculates in your browser.
          {a.impliedGrowth !== null && (
            <>
              {' '}
              <strong className="text-fg-2">Reverse DCF:</strong> at the base-case WACC and terminal growth, the current price of {fmtPrice(a.valuation.price)} implies free cash flow growth of about{' '}
              <strong className="text-fg-2">{a.impliedGrowth.toFixed(1)}% a year</strong> for five years.
            </>
          )}
        </>
      }
    >
      <DcfCalculator cases={a.dcf} price={a.valuation.price} sym={sym} />
      <p className="mt-4 text-xs text-fg-4">Bear/base/bull fair values are outputs of explicit assumptions, not forecasts or price targets.</p>
    </Section>
  )
}

export function Scenarios({ a }: { a: CompanyAnalysis }) {
  const sym = currencySymbol(a.dataset.profile.currency)
  const q = a.dataset.qualitative
  return (
    <Section
      id="scenarios"
      kicker="Scenario analysis · 5 years"
      title="Bear, base and bull — modelled, not predicted"
      description="Each scenario is a set of stated assumptions. The outputs follow mechanically. None is a guaranteed outcome; reality may fall outside all three."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {a.scenarios.map((s) => (
          <div key={s.name} className={`rounded-lg border p-4 ${s.name === 'Bear' ? 'border-neg/30' : s.name === 'Bull' ? 'border-pos/30' : 'border-accent/30'}`}>
            <div className="flex items-center justify-between">
              <h3 className={`font-semibold ${s.name === 'Bear' ? 'text-neg' : s.name === 'Bull' ? 'text-pos' : 'text-accent'}`}>{s.name} case</h3>
              <span className="text-xs text-fg-3">Year {s.years}</span>
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              {[
                ['Revenue', fmtMoney(s.revenue)],
                ['EPS', `${sym}${s.eps.toFixed(2)}`],
                ['Free cash flow', fmtMoney(s.fcf)],
                ['Valuation range', `${sym}${s.valueLow.toFixed(0)} – ${sym}${s.valueHigh.toFixed(0)}`],
                [
                  'Implied annual return',
                  s.impliedAnnualReturnLow === null ? '—' : `${s.impliedAnnualReturnLow.toFixed(1)}% to ${s.impliedAnnualReturnHigh?.toFixed(1)}%`,
                ],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 border-b border-ink-750 py-1">
                  <dt className="text-fg-3">{k}</dt>
                  <dd className="num text-right text-fg">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 text-xs text-fg-3">
              <div className="label mb-1">Assumptions</div>
              Revenue CAGR {s.revenueCagr}% · op. margin {s.operatingMargin}% · tax {s.taxRate}% · shares {s.shareChangePerYear >= 0 ? '+' : ''}
              {s.shareChangePerYear}%/yr · FCF margin {s.fcfMargin}% · exit P/E {s.exitPeLow}–{s.exitPeHigh}×
              <ul className="mt-2 list-disc space-y-0.5 pl-4">
                {s.narrative.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
      {q && (
        <div className="mt-6 grid gap-4 md:grid-cols-2" id="bull-bear">
          <div className="rounded-lg border border-pos/25 p-4">
            <h3 className="mb-2 font-semibold text-pos">Bull case — the evidence</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-fg-2">
              {a.strengths.slice(0, 4).map((i) => (
                <li key={i.id}>
                  {i.label}: {i.display}
                </li>
              ))}
              {q.industry.opportunities.slice(0, 2).map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-neg/25 p-4">
            <h3 className="mb-2 font-semibold text-neg">Bear case — the evidence</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-fg-2">
              {a.concerns.slice(0, 4).map((i) => (
                <li key={i.id}>
                  {i.label}: {i.display}
                </li>
              ))}
              {q.industry.threats.slice(0, 2).map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Section>
  )
}

export function Performance({ a }: { a: CompanyAnalysis }) {
  const sym = currencySymbol(a.dataset.profile.currency)
  return (
    <Section id="performance" kicker="Historical performance & compounding" title="Past returns and long-term compounding" description="Past performance does not guarantee future returns.">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div>
          {a.dataset.pricesSynthetic && (
            <div className="mb-3">
              <Callout tone="demo">Returns below are computed from the synthetic demo price series and are not actual historical returns.</Callout>
            </div>
          )}
          <div className="scrollbar-thin overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Period</th>
                <th className="text-right">{a.dataset.profile.ticker}</th>
                <th className="text-right">S&amp;P 500</th>
                <th className="text-right">NASDAQ</th>
              </tr>
            </thead>
            <tbody>
              {a.performance.map((p) => (
                <tr key={p.label}>
                  <td>{p.label}</td>
                  <td className={`num text-right ${p.value === null ? '' : p.value >= 0 ? 'text-pos' : 'text-neg'}`}>{fmtPct(p.value, 1, true)}</td>
                  <td className="text-right text-xs text-fg-4">n/a</td>
                  <td className="text-right text-xs text-fg-4">n/a</td>
                </tr>
              ))}
              <tr>
                <td>Since IPO</td>
                <td className="text-right text-xs text-fg-4">n/a</td>
                <td className="text-right text-xs text-fg-4">n/a</td>
                <td className="text-right text-xs text-fg-4">n/a</td>
              </tr>
            </tbody>
          </table>
          </div>
          <p className="mt-2 text-xs text-fg-4">Benchmark and since-IPO returns require an index/price-history provider — shown as n/a rather than estimated.</p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-fg">Long-term compounding calculator</h3>
          <CompoundingCalculator sym={sym} />
        </div>
      </div>
    </Section>
  )
}
