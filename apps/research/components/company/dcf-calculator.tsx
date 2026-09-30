'use client'

import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { RotateCcw } from 'lucide-react'
import { marginOfSafety, runDcf, type DcfInputs } from '@/lib/finance/dcf'
import type { DcfCase } from '@/lib/analysis/build'
import { formatValue, RangeTabs } from '@/components/charts/chart-kit'

type Field = { key: keyof DcfInputs; label: string; unit: '%' | 'money' | 'shares'; step: number; methods: DcfInputs['method'][] }

const FIELDS: Field[] = [
  { key: 'currentFcf', label: 'Current free cash flow', unit: 'money', step: 1e9, methods: ['fcf'] },
  { key: 'fcfGrowth', label: 'FCF growth, years 1–5', unit: '%', step: 0.5, methods: ['fcf'] },
  { key: 'currentRevenue', label: 'Current revenue', unit: 'money', step: 1e9, methods: ['revenue'] },
  { key: 'revenueGrowth', label: 'Revenue growth, years 1–5', unit: '%', step: 0.5, methods: ['revenue'] },
  { key: 'operatingMargin', label: 'Operating margin', unit: '%', step: 0.5, methods: ['revenue'] },
  { key: 'taxRate', label: 'Tax rate', unit: '%', step: 0.5, methods: ['revenue'] },
  { key: 'fcfConversion', label: 'FCF conversion (FCF ÷ NOPAT)', unit: '%', step: 1, methods: ['revenue'] },
  { key: 'wacc', label: 'Discount rate (WACC)', unit: '%', step: 0.25, methods: ['fcf', 'revenue'] },
  { key: 'terminalGrowth', label: 'Terminal growth', unit: '%', step: 0.25, methods: ['fcf', 'revenue'] },
  { key: 'netDebt', label: 'Net debt (negative = net cash)', unit: 'money', step: 1e9, methods: ['fcf', 'revenue'] },
  { key: 'shares', label: 'Diluted shares', unit: 'shares', step: 1e7, methods: ['fcf', 'revenue'] },
]

export function DcfCalculator({ cases, price, sym }: { cases: DcfCase[]; price: number; sym: string }) {
  const [caseName, setCaseName] = useState<DcfCase['name']>('Base')
  const initial = cases.find((c) => c.name === caseName)!.inputs
  const [inputs, setInputs] = useState<DcfInputs>(initial)
  const result = useMemo(() => runDcf(inputs), [inputs])
  const mos = result.valid ? marginOfSafety(result.perShare, price) : null
  const edited = JSON.stringify(inputs) !== JSON.stringify(initial)

  const pick = (n: DcfCase['name']) => {
    setCaseName(n)
    setInputs(cases.find((c) => c.name === n)!.inputs)
  }
  const display = (f: Field) => {
    const v = inputs[f.key] as number
    if (f.unit === 'money') return (v / 1e9).toFixed(1)
    if (f.unit === 'shares') return (v / 1e9).toFixed(3)
    return String(v)
  }
  const update = (f: Field, raw: string) => {
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    const v = f.unit === 'money' || f.unit === 'shares' ? n * 1e9 : n
    setInputs({ ...inputs, [f.key]: v })
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {cases.map((c) => (
          <button
            key={c.name}
            type="button"
            onClick={() => pick(c.name)}
            className={clsx('rounded-lg border p-3 text-left transition', c.name === caseName ? 'border-accent bg-accent-soft' : 'border-ink-700 bg-ink-900/60 hover:border-ink-500')}
          >
            <div className="label">{c.name} case fair value</div>
            <div className="num mt-1 text-xl font-semibold text-fg">{c.result.valid ? `${sym}${c.result.perShare.toFixed(2)}` : '—'}</div>
            <div className={clsx('num text-xs', (c.marginOfSafety ?? 0) >= 0 ? 'text-pos' : 'text-neg')}>
              Margin of safety {c.marginOfSafety === null ? '—' : `${c.marginOfSafety >= 0 ? '+' : ''}${c.marginOfSafety.toFixed(0)}%`}
            </div>
            <div className="mt-1 text-[11px] text-fg-3">
              Growth {c.inputs.fcfGrowth}% · WACC {c.inputs.wacc}% · terminal {c.inputs.terminalGrowth}%
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="rounded-lg border border-ink-700 bg-ink-900/50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <RangeTabs
              options={['FCF growth', 'Revenue & margin'] as ('FCF growth' | 'Revenue & margin')[]}
              value={inputs.method === 'fcf' ? 'FCF growth' : 'Revenue & margin'}
              onChange={(v) => setInputs({ ...inputs, method: v === 'FCF growth' ? 'fcf' : 'revenue' })}
            />
            <button type="button" className="text-xs text-fg-3 hover:text-fg disabled:opacity-40" disabled={!edited} onClick={() => setInputs(initial)} title="Reset to case defaults">
              <RotateCcw className="inline h-3.5 w-3.5" /> Reset
            </button>
          </div>
          <div className="space-y-2.5">
            {FIELDS.filter((f) => f.methods.includes(inputs.method)).map((f) => (
              <label key={f.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-fg-2">{f.label}</span>
                <span className="flex items-center gap-1">
                  {f.unit === 'money' && <span className="text-fg-3">{sym}</span>}
                  <input type="number" step={f.unit === 'money' ? 1 : f.unit === 'shares' ? 0.01 : f.step} value={display(f)} onChange={(e) => update(f, e.target.value)} className="input num w-24 py-1 text-right" />
                  <span className="w-6 text-xs text-fg-3">{f.unit === '%' ? '%' : f.unit === 'money' ? 'B' : 'B'}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-fg-4">
            Years 1–5 grow at the stated rate; years 6–10 fade linearly to terminal growth; terminal value uses the Gordon growth formula. Defaults are derived in code from the company’s history and are
            deliberately simple — edit them.
          </p>
        </div>

        <div className="space-y-4">
          {!result.valid ? (
            <div className="rounded-lg border border-neg/30 bg-neg-soft p-4 text-sm text-neg">{result.error}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-lg border border-ink-700 p-3">
                  <div className="label">Fair value / share</div>
                  <div className="num mt-1 text-2xl font-semibold text-fg">
                    {sym}
                    {result.perShare.toFixed(2)}
                  </div>
                  {edited && <div className="text-[11px] text-accent">Your assumptions</div>}
                </div>
                <div className="rounded-lg border border-ink-700 p-3">
                  <div className="label">Current price</div>
                  <div className="num mt-1 text-2xl font-semibold text-fg">
                    {sym}
                    {price.toFixed(2)}
                  </div>
                </div>
                <div className="rounded-lg border border-ink-700 p-3">
                  <div className="label">Margin of safety</div>
                  <div className={clsx('num mt-1 text-2xl font-semibold', (mos ?? 0) >= 0 ? 'text-pos' : 'text-neg')}>
                    {mos! >= 0 ? '+' : ''}
                    {mos!.toFixed(0)}%
                  </div>
                  <div className="text-[11px] text-fg-3">(value − price) ÷ value</div>
                </div>
                <div className="rounded-lg border border-ink-700 p-3">
                  <div className="label">Terminal value share</div>
                  <div className="num mt-1 text-2xl font-semibold text-fg">{result.terminalShareOfValue.toFixed(0)}%</div>
                  <div className="text-[11px] text-fg-3">of enterprise value</div>
                </div>
              </div>
              <div className="scrollbar-thin overflow-x-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Year</th>
                      {result.years.map((y) => (
                        <th key={y.year} className="text-right">
                          {y.year}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Growth</td>
                      {result.years.map((y) => (
                        <td key={y.year} className="num text-right">
                          {y.growth.toFixed(1)}%
                        </td>
                      ))}
                    </tr>
                    {inputs.method === 'revenue' && (
                      <tr>
                        <td>Revenue</td>
                        {result.years.map((y) => (
                          <td key={y.year} className="num text-right">
                            {formatValue(y.revenue, 'money', sym)}
                          </td>
                        ))}
                      </tr>
                    )}
                    <tr>
                      <td className="text-fg">Free cash flow</td>
                      {result.years.map((y) => (
                        <td key={y.year} className="num text-right text-fg">
                          {formatValue(y.fcf, 'money', sym)}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td>Present value</td>
                      {result.years.map((y) => (
                        <td key={y.year} className="num text-right">
                          {formatValue(y.presentValue, 'money', sym)}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm md:grid-cols-3">
                {[
                  ['PV of 10-yr cash flows', result.pvCashFlows],
                  ['PV of terminal value', result.pvTerminal],
                  ['Enterprise value', result.enterpriseValue],
                  ['Less net debt', inputs.netDebt],
                  ['Equity value', result.equityValue],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between border-b border-ink-750 py-1">
                    <dt className="text-fg-3">{k}</dt>
                    <dd className="num text-fg">{formatValue(v as number, 'money', sym)}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
