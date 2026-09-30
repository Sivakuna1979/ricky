'use client'

import { useMemo, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AXIS, ChartTooltip, formatValue, GRID, Legend, RangeTabs, type ValueFormat } from './chart-kit'

export interface Series {
  key: string
  label: string
  color: string
  kind: 'bar' | 'line'
}

type Range = '3Y' | '5Y' | '10Y' | 'MAX'
const N: Record<Range, number> = { '3Y': 3, '5Y': 5, '10Y': 10, MAX: 999 }

/** Annual time series (bars and/or lines on ONE shared axis). */
export function AnnualChart({ data, series, format, sym = '$', height = 240, title }: { data: Record<string, number | null | string>[]; series: Series[]; format: ValueFormat; sym?: string; height?: number; title?: string }) {
  const [range, setRange] = useState<Range>('10Y')
  const rows = useMemo(() => data.slice(-N[range]), [data, range])
  const hasNeg = rows.some((r) => series.some((s) => typeof r[s.key] === 'number' && (r[s.key] as number) < 0))
  return (
    <figure className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="text-sm font-medium text-fg">{title}</figcaption>
        <RangeTabs options={['3Y', '5Y', '10Y', 'MAX'] as Range[]} value={range} onChange={setRange} />
      </div>
      <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" {...AXIS} />
            <YAxis {...AXIS} width={64} tickFormatter={(v) => formatValue(v, format, sym)} />
            {hasNeg && <ReferenceLine y={0} stroke="#3b4d73" />}
            <Tooltip content={<ChartTooltip format={format} sym={sym} />} cursor={{ fill: '#17223a' }} />
            {series.map((s) =>
              s.kind === 'bar' ? (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
              ) : (
                <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: s.color }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
              ),
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
