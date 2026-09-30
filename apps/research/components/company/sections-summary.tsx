import { AlertTriangle, Check } from 'lucide-react'
import type { CompanyAnalysis } from '@/lib/analysis/build'
import { fmtDate, fmtMoney } from '@/lib/format'
import { Section, Callout } from '@/components/ui/section'
import { SourceTag } from '@/components/ui/source-tag'
import { BarList } from '@/components/charts/bar-list'
import { RATING_META } from '@/components/ui/rating'
import type { Rating } from '@/lib/scoring/types'
import { Unavailable } from './primitives'

export function ExecutiveSummary({ a }: { a: CompanyAnalysis }) {
  const s = a.signals
  const order: Rating[] = ['strong_positive', 'positive', 'neutral', 'negative', 'strong_negative']
  const total = order.reduce((n, r) => n + s[r], 0)
  const name = a.dataset.profile.name
  return (
    <Section id="summary" kicker="Executive summary" title={`The evidence on ${name} in one view`}>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4 text-sm leading-relaxed text-fg-2">
          <p>
            Under the default (balanced) methodology, {name} scores <strong className="text-fg">{a.overall.score}/100</strong> — an overall signal of{' '}
            <strong className="text-fg">{a.overall.signal}</strong>. The strongest evidence comes from{' '}
            {a.strengths.slice(0, 3).map((i, k) => (
              <span key={i.id}>
                {k > 0 && (k === 2 ? ' and ' : ', ')}
                <span className="text-fg">{i.label.toLowerCase()}</span>
              </span>
            ))}
            . The main offsets are{' '}
            {a.concerns.slice(0, 3).map((i, k) => (
              <span key={i.id}>
                {k > 0 && (k === 2 ? ' and ' : ', ')}
                <span className="text-fg">{i.label.toLowerCase()}</span>
              </span>
            ))}
            .
          </p>
          <p>
            Valuation reads as <strong className="text-fg">{a.labels.valuation ?? 'unavailable'}</strong>, the balance sheet as{' '}
            <strong className="text-fg">{a.labels.balanceSheet ?? 'unavailable'}</strong>, overall risk as <strong className="text-fg">{a.labels.risk ?? 'unavailable'}</strong> and the moat as{' '}
            <strong className="text-fg">{a.moat.rating ?? 'unavailable'}</strong>.
            {a.impliedGrowth !== null && (
              <>
                {' '}
                A reverse DCF suggests today’s price implies about <strong className="text-fg">{a.impliedGrowth.toFixed(1)}% a year</strong> free-cash-flow growth for five years (at the base-case discount rate) — the key assumption to test.
              </>
            )}
          </p>
          <Callout>
            This summary is assembled from the scored indicators below — it is not free-form AI text. A score of {a.overall.score} means the weight of evidence is {a.overall.signal.toLowerCase()} under this
            methodology; it is <strong>not</strong> a {a.overall.score}% chance of the share price rising.
          </Callout>
        </div>
        <div className="rounded-lg border border-ink-700 bg-ink-900/60 p-4">
          <div className="label mb-3">Evidence balance · {total} scored indicators</div>
          <div className="mb-4 flex h-2.5 overflow-hidden rounded-full" aria-hidden>
            {order.map((r) => (
              <div key={r} style={{ width: `${(s[r] / Math.max(total, 1)) * 100}%` }} className={r.includes('positive') ? (r === 'strong_positive' ? 'bg-pos' : 'bg-pos/60') : r === 'neutral' ? 'bg-neu' : r === 'negative' ? 'bg-neg/60' : 'bg-neg'} />
            ))}
          </div>
          <ul className="space-y-1.5 text-sm">
            {order.map((r) => {
              const M = RATING_META[r]
              return (
                <li key={r} className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-2 ${M.cls.split(' ').find((c) => c.startsWith('text-'))}`}>
                    <M.Icon className="h-4 w-4" /> <span className="text-fg-2">{M.label}</span>
                  </span>
                  <span className="num font-semibold text-fg">{s[r]}</span>
                </li>
              )
            })}
            <li className="flex items-center justify-between border-t border-ink-700 pt-1.5 text-fg-3">
              <span>No data (excluded)</span>
              <span className="num">{s.unavailable}</span>
            </li>
          </ul>
        </div>
      </div>
    </Section>
  )
}

export function Thesis({ a }: { a: CompanyAnalysis }) {
  return (
    <Section id="thesis" kicker="Investment thesis" title="Why investors may be attracted — and what could go wrong" description="Both columns are drawn from the same scored evidence; neither side is favoured.">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-pos/25 bg-pos-soft p-4">
          <h3 className="mb-3 font-semibold text-pos">Why investors may be attracted</h3>
          <ul className="space-y-3">
            {a.strengths.map((i) => (
              <li key={i.id} className="flex gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-pos" aria-hidden />
                <span>
                  <span className="font-medium text-fg">
                    {i.label} — {i.display}
                  </span>
                  <span className="block text-fg-3">{i.rationale}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-neg/25 bg-neg-soft p-4">
          <h3 className="mb-3 font-semibold text-neg">What could go wrong</h3>
          <ul className="space-y-3">
            {a.concerns.map((i) => (
              <li key={i.id} className="flex gap-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-neg" aria-hidden />
                <span>
                  <span className="font-medium text-fg">
                    {i.label} — {i.display}
                  </span>
                  <span className="block text-fg-3">{i.rationale}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  )
}

export function Overview({ a }: { a: CompanyAnalysis }) {
  const ds = a.dataset
  const q = ds.qualitative
  const seg = ds.segments
  const ccy = ds.profile.currency
  return (
    <Section
      id="overview"
      kicker="Company overview & business model"
      title="What does this company actually do?"
      actions={q && <SourceTag source={ds.sources[q.sourceId]} />}
    >
      <p className="max-w-4xl text-sm leading-relaxed text-fg-2">{ds.profile.description}</p>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-fg">How it makes money</h3>
          {q ? (
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-fg-2">
              {[...q.businessModel, ...q.revenueStreams].map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : (
            <Unavailable title="Business model notes">Requires a reviewed editorial profile for this company.</Unavailable>
          )}
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            {[
              ['CEO', ds.profile.ceo ? `${ds.profile.ceo}${ds.profile.ceoSince ? ` (since ${ds.profile.ceoSince})` : ''}` : '—'],
              ['Listed since', ds.profile.ipoDate ? fmtDate(ds.profile.ipoDate) : '—'],
              ['Country', ds.profile.country],
              ['Fiscal year ends', ds.profile.fiscalYearEndMonth ? new Date(2000, ds.profile.fiscalYearEndMonth - 1, 1).toLocaleString('en-GB', { month: 'long' }) : '—'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-fg-3">{k}</dt>
                <dd className="text-fg">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="space-y-6" id="revenue">
          {seg ? (
            <>
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-fg">Revenue by product / service · FY{seg.fiscalYear}</h3>
                  <SourceTag source={ds.sources[seg.sourceId]} />
                </div>
                <BarList items={seg.byProduct} format={(v) => fmtMoney(v, ccy)} color="#3987e5" />
              </div>
              <div id="geography">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-fg">Revenue by region · FY{seg.fiscalYear}</h3>
                  <SourceTag source={ds.sources[seg.sourceId]} />
                </div>
                <BarList items={seg.byGeography} format={(v) => fmtMoney(v, ccy)} color="#199e70" />
              </div>
            </>
          ) : (
            <Unavailable title="Segment and geographic revenue">Requires segment data from filings (XBRL) or a provider that supplies it.</Unavailable>
          )}
        </div>
      </div>
      {q && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-ink-700 p-4">
            <h3 className="mb-2 text-sm font-semibold text-fg">Geographic exposure</h3>
            <dl className="space-y-2 text-sm">
              {(
                [
                  ['Manufacturing', q.geographicNotes.manufacturing],
                  ['Suppliers', q.geographicNotes.suppliers],
                  ['Currency', q.geographicNotes.currency],
                  ['Political / geopolitical', q.geographicNotes.political],
                ] as const
              ).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-fg-3">{k}</dt>
                  <dd className="text-fg-2">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-lg border border-ink-700 p-4" id="concentration">
            <h3 className="mb-2 text-sm font-semibold text-fg">Customer, supplier & platform concentration</h3>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-fg-2">
              {q.concentrationNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Section>
  )
}

export function DataQuality({ a }: { a: CompanyAnalysis }) {
  const ds = a.dataset
  return (
    <Section id="data-quality" kicker="Data quality" title={`Data confidence: ${a.confidence.score}%`} description="How much weight the score can bear. Incomplete or unverified data lowers confidence rather than being filled in.">
      {ds.mode === 'demo' && (
        <Callout tone="demo" title="DEMO DATA">
          No live data provider is connected. Figures on this page come from an illustrative demo dataset that approximates the shape of public filings but has not been verified. Do not use them for
          decisions. Connect SEC EDGAR / a financial data API to replace them with sourced figures.
        </Callout>
      )}
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div className="scrollbar-thin overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Component</th>
              <th className="text-right">Weight</th>
              <th className="text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {a.confidence.components.map((c) => (
              <tr key={c.key}>
                <td className="whitespace-normal">
                  <div className="text-fg">{c.label}</div>
                  <div className="text-xs text-fg-3">{c.note}</div>
                </td>
                <td className="num text-right">{c.weight}%</td>
                <td className="num text-right">{c.score === null ? '—' : Math.round(c.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold text-fg">Sources used on this page</h3>
          <ul className="space-y-2 text-sm">
            {Object.values(ds.sources).map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 rounded-lg border border-ink-700 px-3 py-2">
                <span className="min-w-0">
                  <span className="block text-fg-2">{s.name}</span>
                  <span className="text-xs text-fg-4">
                    {s.period ? `${s.period} · ` : ''}Updated {fmtDate(s.updated)}
                  </span>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-accent hover:underline">
                      {s.url}
                    </a>
                  )}
                </span>
                <SourceTag source={s} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  )
}
