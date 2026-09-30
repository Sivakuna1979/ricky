'use client'

import { useState } from 'react'
import { compound } from '@/lib/finance/scenarios'

const RATES = [4, 6, 8, 10, 12, 15]
const YEARS = [5, 10, 15, 20, 30]

export function CompoundingCalculator({ sym }: { sym: string }) {
  const [principal, setPrincipal] = useState(10000)
  const [monthly, setMonthly] = useState(0)
  const f = (v: number) => `${sym}${Math.round(v).toLocaleString('en-US')}`
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="text-sm text-fg-2">
          <span className="label mb-1 block">Initial amount</span>
          <input type="number" min={0} step={1000} value={principal} onChange={(e) => setPrincipal(Math.max(0, Number(e.target.value) || 0))} className="input num w-40" />
        </label>
        <label className="text-sm text-fg-2">
          <span className="label mb-1 block">Monthly contribution</span>
          <input type="number" min={0} step={50} value={monthly} onChange={(e) => setMonthly(Math.max(0, Number(e.target.value) || 0))} className="input num w-40" />
        </label>
        <p className="max-w-md text-xs text-fg-3">
          A mathematical scenario, not a forecast: it shows what constant annualised returns would produce. Real returns vary year to year and can be negative.
        </p>
      </div>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Annualised return</th>
              {YEARS.map((y) => (
                <th key={y} className="text-right">
                  {y} years
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RATES.map((r) => (
              <tr key={r}>
                <td className="text-fg">{r}% a year</td>
                {YEARS.map((y) => (
                  <td key={y} className="num text-right">
                    {f(compound(principal, r, y, monthly))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
