'use client'

import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AXIS, ChartTooltip, GRID, Legend, RangeTabs } from './chart-kit'
import { smaSeries } from '@/lib/finance/technical'

type Range = '1Y' | '3Y' | '5Y' | '10Y' | 'MAX'
const WEEKS: Record<Range, number> = { '1Y': 52, '3Y': 156, '5Y': 260, '10Y': 520, MAX: 99999 }

/** Weekly closes with 10- and 40-week averages (≈50/200-day). */
export function PriceChart({ prices, sym = '$', synthetic }: { prices: { date: string; close: number }[]; sym?: string; synthetic?: boolean }) {
  const [range, setRange] = useState<Range>('5Y')
  const full = useMemo(() => {
    const closes = prices.map((p) => p.close)
    const s10 = smaSeries(closes, 10)
    const s40 = smaSeries(closes, 40)
    return prices.map((p, i) => ({ date: p.date, close: p.close, sma50: s10[i], sma200: s40[i] }))
  }, [prices])
  const rows = full.slice(-WEEKS[range])
  return (
    <figure className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="text-sm font-medium text-fg">
          Share price {synthetic && <span className="ml-1 rounded border border-neu/40 bg-neu-soft px-1.5 py-px text-[10px] font-semibold uppercase text-neu">Synthetic demo series</span>}
        </figcaption>
        <RangeTabs options={['1Y', '3Y', '5Y', '10Y', 'MAX'] as Range[]} value={range} onChange={setRange} />
      </div>
      <Legend
        items={[
          { label: 'Close', color: '#3987e5' },
          { label: '~50-day avg', color: '#c98500' },
          { label: '~200-day avg', color: '#9085e9' },
        ]}
      />
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="date" {...AXIS} minTickGap={48} tickFormatter={(d: string) => (range === '1Y' ? d.slice(5, 10) : d.slice(0, 7))} />
            <YAxis {...AXIS} width={56} domain={['auto', 'auto']} tickFormatter={(v) => `${sym}${Math.round(v)}`} />
            <Tooltip content={<ChartTooltip format="price" sym={sym} />} cursor={{ stroke: '#3b4d73' }} />
            <Line dataKey="close" name="Close" stroke="#3987e5" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="sma50" name="~50-day avg" stroke="#c98500" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
            <Line dataKey="sma200" name="~200-day avg" stroke="#9085e9" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
