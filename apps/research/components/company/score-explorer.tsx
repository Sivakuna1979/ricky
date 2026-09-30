'use client'

import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react'
import { scoreOverall } from '@/lib/scoring/engine'
import { CATEGORY_LABELS, CATEGORY_ORDER, type CategoryScore, type InvestorMode, type Weights } from '@/lib/scoring/types'
import { MODE_INFO, MODE_WEIGHTS } from '@/lib/scoring/weights'
import { ScoreRing, ScoreBar } from '@/components/ui/score'

const MODES: InvestorMode[] = ['balanced', 'value', 'quality', 'growth', 'dividend', 'garp', 'buffett', 'graham', 'lynch', 'custom']

const CAT_ANCHOR: Record<string, string> = {
  financial_strength: '#balance-sheet',
  business_quality: '#moat',
  profitability: '#profitability',
  growth: '#growth',
  cash_flow: '#cash-flow',
  valuation: '#valuation',
  management: '#management',
  risk: '#risk',
  technical: '#technical',
  sentiment: '#news',
  dividend: '#dividend',
}

export function ScoreExplorer({ categories, confidence }: { categories: CategoryScore[]; confidence: number }) {
  const [mode, setMode] = useState<InvestorMode>('balanced')
  const [custom, setCustom] = useState<Weights>({ ...MODE_WEIGHTS.balanced })
  const [why, setWhy] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const overall = useMemo(() => scoreOverall(categories, mode, custom), [categories, mode, custom])

  const byKey = new Map(categories.map((c) => [c.key, c]))
  const shown = CATEGORY_ORDER.filter((k) => overall.weightsUsed[k] > 0 || overall.excluded.includes(k))
  const positives = overall.contributions.filter((c) => c.points > 0)
  const negatives = overall.contributions.filter((c) => c.points < 0)
  const customTotal = CATEGORY_ORDER.reduce((s, k) => s + custom[k], 0)

  return (
    <div className="card card-pad" id="score">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="label">Investment Quality Score</div>
          <p className="mt-1 max-w-2xl text-sm text-fg-3">
            The strength of positive and negative evidence under this platform’s methodology — <strong className="text-fg-2">not</strong> a probability that the share price will rise.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-fg-2">
          <span className="label">Investor mode</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as InvestorMode)} className="input w-auto py-1.5">
            {MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_INFO[m].label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[220px_1fr]">
        <div className="flex flex-col items-center gap-3 border-ink-700 lg:border-r lg:pr-6">
          <ScoreRing score={overall.score} size={148} sub={overall.signal} />
          <div className="text-center text-xs text-fg-3">
            Data confidence <span className="num font-semibold text-fg">{confidence}%</span>
          </div>
          <button type="button" onClick={() => setWhy((w) => !w)} className="btn btn-primary w-full justify-center" aria-expanded={why}>
            Why {overall.score ?? '—'}? {why ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <p className="text-center text-xs text-fg-4">{MODE_INFO[mode].description}</p>
        </div>

        <div className="grid content-start gap-x-8 gap-y-4 sm:grid-cols-2">
          {shown.map((k) => {
            const c = byKey.get(k)
            const excluded = overall.excluded.includes(k)
            return (
              <ScoreBar
                key={k}
                href={CAT_ANCHOR[k]}
                label={CATEGORY_LABELS[k]}
                score={c?.score ?? null}
                hint={excluded ? 'No data — excluded, weight redistributed' : `Weight ${overall.weightsUsed[k].toFixed(1)}% · ${c?.available}/${c?.total} indicators with data`}
              />
            )
          })}
        </div>
      </div>

      {mode === 'custom' && (
        <div className="mt-6 rounded-lg border border-ink-700 bg-ink-900/50 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-fg">
            <SlidersHorizontal className="h-4 w-4" /> Custom strategy weights
            <span className="ml-auto text-xs text-fg-3">Raw total {customTotal.toFixed(0)} — normalised to 100% automatically</span>
          </div>
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORY_ORDER.map((k) => (
              <label key={k} className="text-xs text-fg-2">
                <span className="flex justify-between">
                  {CATEGORY_LABELS[k]}
                  <span className="num text-fg">{custom[k]}</span>
                </span>
                <input type="range" min={0} max={40} step={0.5} value={custom[k]} onChange={(e) => setCustom({ ...custom, [k]: Number(e.target.value) })} className="w-full accent-[#4c8dff]" />
              </label>
            ))}
          </div>
        </div>
      )}

      {why && (
        <div className="mt-6 space-y-5 border-t border-ink-700 pt-5">
          <div>
            <h3 className="text-base font-semibold text-fg">How {overall.score} was calculated</h3>
            <p className="mt-1 text-sm text-fg-3">
              Every indicator is scored 0–100 by a published curve (50 = neutral). Category scores are weighted averages of their indicators; the overall score is the weighted average of categories.
              Equivalently: <span className="num text-fg-2">start at 50, then add each indicator’s points</span>. Nothing here is generated by AI.
            </p>
          </div>
          <div className="scrollbar-thin overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Category</th>
                  <th className="text-right">Score</th>
                  <th className="text-right">Weight</th>
                  <th className="text-right">Points vs neutral</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="text-fg-3">Neutral baseline</td>
                  <td />
                  <td />
                  <td className="num text-right text-fg">50.0</td>
                </tr>
                {overall.categoryContributions.map((c) => (
                  <tr key={c.key}>
                    <td className="text-fg">{CATEGORY_LABELS[c.key]}</td>
                    <td className="num text-right">{c.score}</td>
                    <td className="num text-right">{c.weight.toFixed(1)}%</td>
                    <td className={clsx('num text-right font-medium', c.points >= 0 ? 'text-pos' : 'text-neg')}>
                      {c.points >= 0 ? '+' : ''}
                      {c.points.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {overall.excluded.map((k) => (
                  <tr key={k}>
                    <td className="text-fg-3">{CATEGORY_LABELS[k]}</td>
                    <td colSpan={3} className="text-right text-xs text-fg-4">
                      Excluded — no data (its weight is redistributed; Data Confidence is reduced)
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="font-semibold text-fg">Investment Quality Score</td>
                  <td />
                  <td className="num text-right">100%</td>
                  <td className="num text-right text-base font-semibold text-fg">{overall.score}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {[
              { title: 'Indicators that added points', list: positives, tone: 'text-pos' },
              { title: 'Indicators that removed points', list: negatives, tone: 'text-neg' },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="mb-2 text-sm font-semibold text-fg">{col.title}</h4>
                <ul className="divide-y divide-ink-750 rounded-lg border border-ink-700">
                  {(showAll ? col.list : col.list.slice(0, 10)).map((c) => (
                    <li key={c.indicatorId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate text-fg-2">{c.label}</span>
                        <span className="text-xs text-fg-4">
                          {CATEGORY_LABELS[c.category]} · indicator score {c.score}
                        </span>
                      </span>
                      <span className={clsx('num shrink-0 font-semibold', col.tone)}>
                        {c.points >= 0 ? '+' : ''}
                        {c.points.toFixed(2)}
                      </span>
                    </li>
                  ))}
                  {col.list.length === 0 && <li className="px-3 py-2 text-sm text-fg-4">None</li>}
                </ul>
              </div>
            ))}
          </div>
          {(positives.length > 10 || negatives.length > 10) && (
            <button type="button" className="btn" onClick={() => setShowAll((s) => !s)}>
              {showAll ? 'Show top 10 only' : `Show all ${overall.contributions.length} indicators`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
