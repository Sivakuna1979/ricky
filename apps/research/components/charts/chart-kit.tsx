'use client'

import clsx from 'clsx'

export type ValueFormat = 'money' | 'pct' | 'num' | 'price' | 'shares'

export function formatValue(v: number | null | undefined, f: ValueFormat, sym = '$'): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  const sign = v < 0 ? '−' : ''
  switch (f) {
    case 'money':
      if (a >= 1e12) return `${sign}${sym}${(a / 1e12).toFixed(2)}T`
      if (a >= 1e9) return `${sign}${sym}${(a / 1e9).toFixed(1)}B`
      if (a >= 1e6) return `${sign}${sym}${(a / 1e6).toFixed(0)}M`
      return `${sign}${sym}${a.toFixed(0)}`
    case 'shares':
      return a >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : `${(v / 1e6).toFixed(0)}M`
    case 'pct':
      return `${v.toFixed(1)}%`
    case 'price':
      return `${sym}${v.toFixed(2)}`
    default:
      return v.toFixed(2)
  }
}

export const AXIS = { stroke: '#2a3a5c', tick: { fill: '#7f8ea9', fontSize: 11 }, tickLine: false, axisLine: false }
export const GRID = { stroke: '#1d2a45', strokeDasharray: '0', vertical: false }

export function RangeTabs<T extends string>({ options, value, onChange }: { options: T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-ink-600 bg-ink-900 p-0.5" role="tablist">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="tab"
          aria-selected={o === value}
          onClick={() => onChange(o)}
          className={clsx('rounded-md px-2.5 py-1 text-xs font-medium transition', o === value ? 'bg-ink-700 text-fg' : 'text-fg-3 hover:text-fg')}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

interface TipProps {
  active?: boolean
  label?: string | number
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[]
  format: ValueFormat
  sym?: string
}

export function ChartTooltip({ active, label, payload, format, sym }: TipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-ink-600 bg-ink-900/95 px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-medium text-fg">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-fg-2">
            <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="num font-medium text-fg">{formatValue(p.value, format, sym)}</span>
        </div>
      ))}
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  if (items.length < 2) return null
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-2">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4" style={{ background: i.dashed ? `repeating-linear-gradient(90deg, ${i.color} 0 4px, transparent 4px 7px)` : i.color, height: 2 }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}
