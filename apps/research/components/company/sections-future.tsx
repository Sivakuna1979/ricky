import clsx from 'clsx'
import { AlertTriangle, Check, CircleDashed, Eye, Minus, X } from 'lucide-react'
import type { CompanyAnalysis } from '@/lib/analysis/build'
import { categoryScore } from '@/lib/scoring/engine'
import { Section } from '@/components/ui/section'
import { ScoreRing, BlockBar } from '@/components/ui/score'
import { SourceTag } from '@/components/ui/source-tag'
import type { CheckStatus } from '@/lib/scoring/checklist'
import { Unavailable } from './primitives'

const KIND: Record<string, { label: string; cls: string }> = {
  fact: { label: 'Known fact', cls: 'border-accent/40 text-accent' },
  expectation: { label: 'Current expectation', cls: 'border-pos/40 text-pos' },
  assumption: { label: 'Assumption', cls: 'border-neu/40 text-neu' },
  scenario: { label: 'Scenario', cls: 'border-series-5 text-series-5' },
  uncertainty: { label: 'Uncertainty', cls: 'border-neg/40 text-neg' },
}

export function Outlook({ a }: { a: CompanyAnalysis }) {
  const q = a.dataset.qualitative
  return (
    <Section
      id="outlook"
      kicker="Future outlook"
      title="1, 3, 5 and 10-year business outlook"
      description="Every statement is labelled as a known fact, a current expectation, an assumption, a scenario or an uncertainty. No share-price predictions."
      actions={q && <SourceTag source={a.dataset.sources[q.sourceId]} />}
    >
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="flex justify-around gap-4 lg:flex-col lg:items-center">
          <ScoreRing score={a.futureOpportunity} size={104} label="Future Opportunity" />
          <div className="flex flex-col items-center gap-1">
            <ScoreRing score={a.futureRisk === null ? null : 100 - a.futureRisk} size={104} label="Future Risk" />
            <div className="num text-xs text-fg-3">Risk level {a.futureRisk ?? '—'}/100 (ring shows safety)</div>
          </div>
        </div>
        {q ? (
          <div className="grid gap-4 md:grid-cols-2">
            {q.outlook.map((o) => (
              <div key={o.horizon} className="rounded-lg border border-ink-700 p-4">
                <h3 className="mb-2 font-semibold text-fg">{o.horizon === '10Y' ? '10-year strategic outlook' : `${o.horizon.replace('Y', '-year')} business outlook`}</h3>
                <ul className="space-y-2">
                  {o.statements.map((s) => (
                    <li key={s.text} className="text-sm text-fg-2">
                      <span className={clsx('chip mr-1.5 text-[10px] uppercase tracking-wider', KIND[s.kind].cls)}>{KIND[s.kind].label}</span>
                      {s.text}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <Unavailable title="Outlook narrative">Requires a reviewed editorial profile.</Unavailable>
        )}
      </div>
      <p className="mt-4 text-xs text-fg-4">
        Future Opportunity blends growth scores, consensus expectations, R&amp;D intensity, market runway and moat. Future Risk blends the risk category with valuation risk. Both are computed, not written by AI.
      </p>
    </Section>
  )
}

const CK: Record<CheckStatus, { Icon: typeof Check; cls: string; word: string }> = {
  pass: { Icon: Check, cls: 'text-pos', word: 'Positive' },
  neutral: { Icon: Minus, cls: 'text-neu', word: 'Neutral' },
  fail: { Icon: X, cls: 'text-neg', word: 'Negative' },
  unavailable: { Icon: CircleDashed, cls: 'text-fg-4', word: 'No data' },
}

export function Checklist({ a }: { a: CompanyAnalysis }) {
  const groups = [...new Set(a.checklist.items.map((i) => i.group))]
  const n = a.checklist.counts
  return (
    <Section id="checklist" kicker="Investment checklist" title={`${a.checklist.items.length} questions, answered by the evidence`}>
      <div className="mb-5 flex flex-wrap gap-3 text-sm">
        <span className="chip border-pos/40 bg-pos-soft text-pos">✓ Positive: {n.pass}</span>
        <span className="chip border-neu/40 bg-neu-soft text-neu">– Neutral: {n.neutral}</span>
        <span className="chip border-neg/40 bg-neg-soft text-neg">✗ Negative: {n.fail}</span>
        <span className="chip border-ink-600 text-fg-3">No data: {n.unavailable}</span>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <div key={g}>
            <h3 className="label mb-2">{g}</h3>
            <ul className="space-y-1.5">
              {a.checklist.items
                .filter((i) => i.group === g)
                .map((i) => {
                  const S = CK[i.status]
                  return (
                    <li key={i.question} className="flex gap-2 text-sm">
                      <S.Icon className={clsx('mt-0.5 h-4 w-4 shrink-0', S.cls)} aria-label={S.word} />
                      <span>
                        <span className="text-fg-2">{i.question}</span>
                        <span className="block text-xs text-fg-4">{i.evidence}</span>
                      </span>
                    </li>
                  )
                })}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  )
}

export function Psychology() {
  const biases = [
    ['FOMO', 'Buying because a price is rising and others are profiting.'],
    ['Anchoring', 'Judging value against a past price you remember, not the business.'],
    ['Confirmation bias', 'Reading only the evidence that supports what you already believe.'],
    ['Recency bias', 'Assuming the last year or two will continue indefinitely.'],
    ['Loss aversion', 'Holding a loser to avoid “locking in” a loss.'],
    ['Overconfidence', 'Trusting a single model or forecast too much.'],
    ['Herd mentality', 'Following the crowd rather than the evidence.'],
  ]
  return (
    <section className="rounded-xl border border-accent/30 bg-accent-soft p-5 sm:p-6" aria-labelledby="psy-h">
      <h2 id="psy-h" className="text-lg font-semibold text-fg">
        Before drawing conclusions: are you analysing the company or reacting to the stock price?
      </h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {biases.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-ink-700 bg-ink-900/60 p-3 text-sm">
            <div className="font-medium text-fg">{k}</div>
            <div className="text-xs text-fg-3">{v}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function InvestmentPicture({ a }: { a: CompanyAnalysis }) {
  const c = (k: Parameters<typeof categoryScore>[1]) => categoryScore(a.categories, k)
  const rows: [string, number | null][] = [
    ['Business Quality', c('business_quality')],
    ['Financial Strength', c('financial_strength')],
    ['Profitability', c('profitability')],
    ['Growth', c('growth')],
    ['Cash Flow', c('cash_flow')],
    ['Valuation', c('valuation')],
    ['Moat', a.moat.score],
    ['Management', c('management')],
    ['Risk (higher = safer)', c('risk')],
  ]
  const monitor = a.dataset.qualitative?.monitor ?? ['Next earnings release', 'Changes in valuation multiples', 'Cash flow vs earnings', 'Share count trend', 'Debt levels']
  return (
    <section id="picture" className="card card-pad border-accent/30" aria-labelledby="picture-h">
      <div className="label mb-1">Final company summary</div>
      <h2 id="picture-h" className="text-xl font-semibold text-fg">
        The investment picture — {a.dataset.profile.name}
      </h2>
      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <ul className="space-y-2">
            {rows.map(([k, v]) => (
              <li key={k} className="grid grid-cols-[150px_1fr_40px] items-center gap-3 text-sm">
                <span className="text-fg-2">{k}</span>
                <BlockBar score={v} />
                <span className="num text-right font-semibold text-fg">{v ?? '—'}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-center justify-between rounded-lg border border-ink-600 bg-ink-900 p-4">
            <div>
              <div className="label">Overall Investment Quality</div>
              <div className="text-sm text-fg-3">
                {a.overall.signal} · Data confidence {a.confidence.score}%
              </div>
            </div>
            <div className="num text-3xl font-semibold text-fg">
              {a.overall.score} <span className="text-base text-fg-4">/ 100</span>
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-pos">Key strengths</h3>
            <ul className="space-y-1.5 text-sm">
              {a.strengths.map((s) => (
                <li key={s.id} className="flex gap-2 text-fg-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-pos" />
                  {s.label}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-neg">Key concerns</h3>
            <ul className="space-y-1.5 text-sm">
              {a.concerns.map((s) => (
                <li key={s.id} className="flex gap-2 text-fg-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-neg" />
                  {s.label}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-accent">What to monitor</h3>
            <ul className="space-y-1.5 text-sm">
              {monitor.slice(0, 5).map((m) => (
                <li key={m} className="flex gap-2 text-fg-2">
                  <Eye className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
