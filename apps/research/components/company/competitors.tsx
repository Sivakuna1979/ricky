'use client'

import { useState } from 'react'
import clsx from 'clsx'
import type { CompanySnapshot } from '@/lib/domain/types'
import { formatValue } from '@/components/charts/chart-kit'

type Row = CompanySnapshot & { self?: boolean; iqs?: number | null }

const COLS: { key: keyof CompanySnapshot; label: string; fmt: 'money' | 'pct' | 'x' }[] = [
  { key: 'marketCap', label: 'Market cap', fmt: 'money' },
  { key: 'revenue', label: 'Revenue', fmt: 'money' },
  { key: 'revenueGrowth', label: 'Rev. growth', fmt: 'pct' },
  { key: 'pe', label: 'P/E', fmt: 'x' },
  { key: 'forwardPe', label: 'Fwd P/E', fmt: 'x' },
  { key: 'operatingMargin', label: 'Op. margin', fmt: 'pct' },
  { key: 'netMargin', label: 'Net margin', fmt: 'pct' },
  { key: 'roe', label: 'ROE', fmt: 'pct' },
  { key: 'roic', label: 'ROIC', fmt: 'pct' },
  { key: 'totalDebt', label: 'Debt', fmt: 'money' },
  { key: 'fcf', label: 'FCF', fmt: 'money' },
  { key: 'fcfGrowth', label: 'FCF growth', fmt: 'pct' },
  { key: 'fcfYield', label: 'FCF yield', fmt: 'pct' },
  { key: 'evToEbitda', label: 'EV/EBITDA', fmt: 'x' },
]

export function Competitors({ self, peers, universe, sym }: { self: Row; peers: CompanySnapshot[]; universe: CompanySnapshot[]; sym: string }) {
  const [selected, setSelected] = useState<string[]>(peers.map((p) => p.ticker))
  const rows: Row[] = [self, ...universe.filter((u) => selected.includes(u.ticker))]
  const fmt = (v: unknown, f: 'money' | 'pct' | 'x') => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '—'
    if (f === 'money') return formatValue(v, 'money', sym)
    if (f === 'pct') return `${v.toFixed(1)}%`
    return `${v.toFixed(1)}×`
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="label mr-1">Compare with</span>
        {universe
          .filter((u) => u.ticker !== self.ticker)
          .map((u) => {
            const on = selected.includes(u.ticker)
            return (
              <button
                key={u.ticker}
                type="button"
                aria-pressed={on}
                onClick={() => setSelected(on ? selected.filter((t) => t !== u.ticker) : [...selected, u.ticker])}
                className={clsx('chip', on ? 'border-accent/50 bg-accent-soft text-accent' : 'border-ink-600 text-fg-3 hover:text-fg')}
              >
                {u.ticker}
              </button>
            )
          })}
      </div>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-ink-850">Company</th>
              {COLS.map((c) => (
                <th key={c.key} className="text-right">
                  {c.label}
                </th>
              ))}
              <th className="text-right">Quality score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ticker} className={r.self ? 'bg-accent-soft' : ''}>
                <td className="sticky left-0 z-10 bg-ink-850">
                  <div className="font-semibold text-fg">{r.ticker}</div>
                  <div className="max-w-[180px] truncate text-xs text-fg-3">{r.industry}</div>
                </td>
                {COLS.map((c) => (
                  <td key={c.key} className="num text-right">
                    {fmt(r[c.key], c.fmt)}
                  </td>
                ))}
                <td className="num text-right">{r.self ? <span className="font-semibold text-fg">{r.iqs}</span> : <span className="text-xs text-fg-4" title="A full Investment Quality Score needs a full dataset for this company">Needs full data</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
