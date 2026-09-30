'use client'

import { useState } from 'react'
import clsx from 'clsx'
import type { AnnualFinancials } from '@/lib/domain/types'
import { RangeTabs, formatValue } from '@/components/charts/chart-kit'

type Stmt = 'Income statement' | 'Balance sheet' | 'Cash flow'
type View = 'Raw' | 'Growth %' | 'Common-size %'
type Key = keyof AnnualFinancials

const LINES: Record<Stmt, { key: Key; label: string; strong?: boolean; per?: boolean }[]> = {
  'Income statement': [
    { key: 'revenue', label: 'Revenue', strong: true },
    { key: 'costOfRevenue', label: 'Cost of revenue' },
    { key: 'grossProfit', label: 'Gross profit', strong: true },
    { key: 'researchAndDevelopment', label: 'Research & development' },
    { key: 'sellingGeneralAdmin', label: 'Selling, general & admin' },
    { key: 'operatingIncome', label: 'Operating income (EBIT)', strong: true },
    { key: 'interestExpense', label: 'Interest expense' },
    { key: 'pretaxIncome', label: 'Pre-tax income' },
    { key: 'incomeTax', label: 'Income tax' },
    { key: 'netIncome', label: 'Net income', strong: true },
    { key: 'ebitda', label: 'EBITDA' },
    { key: 'epsDiluted', label: 'Diluted EPS', per: true },
    { key: 'sharesDiluted', label: 'Diluted shares' },
  ],
  'Balance sheet': [
    { key: 'cash', label: 'Cash & equivalents' },
    { key: 'shortTermInvestments', label: 'Short-term investments' },
    { key: 'receivables', label: 'Receivables' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'currentAssets', label: 'Total current assets', strong: true },
    { key: 'longTermInvestments', label: 'Long-term investments' },
    { key: 'netPPE', label: 'Property, plant & equipment (net)' },
    { key: 'goodwill', label: 'Goodwill' },
    { key: 'intangibles', label: 'Intangible assets' },
    { key: 'totalAssets', label: 'Total assets', strong: true },
    { key: 'currentLiabilities', label: 'Total current liabilities' },
    { key: 'shortTermDebt', label: 'Short-term debt' },
    { key: 'longTermDebt', label: 'Long-term debt' },
    { key: 'totalDebt', label: 'Total debt', strong: true },
    { key: 'totalLiabilities', label: 'Total liabilities', strong: true },
    { key: 'equity', label: 'Shareholders’ equity', strong: true },
  ],
  'Cash flow': [
    { key: 'operatingCashFlow', label: 'Operating cash flow', strong: true },
    { key: 'capex', label: 'Capital expenditure' },
    { key: 'freeCashFlow', label: 'Free cash flow', strong: true },
    { key: 'stockBasedCompensation', label: 'Stock-based compensation' },
    { key: 'dividendsPaid', label: 'Dividends paid' },
    { key: 'buybacks', label: 'Share repurchases' },
    { key: 'acquisitions', label: 'Acquisitions' },
    { key: 'dividendPerShare', label: 'Dividend per share', per: true },
  ],
}

const BASE: Record<Stmt, Key> = { 'Income statement': 'revenue', 'Balance sheet': 'totalAssets', 'Cash flow': 'revenue' }

export function FinancialStatements({ annual, currency, sym, demo }: { annual: AnnualFinancials[]; currency: string; sym: string; demo: boolean }) {
  const [stmt, setStmt] = useState<Stmt>('Income statement')
  const [view, setView] = useState<View>('Raw')
  const [period, setPeriod] = useState<'Annual' | 'Quarterly'>('Annual')
  const years = [...annual].reverse().slice(0, 10)
  const cell = (y: AnnualFinancials, idx: number, key: Key, per?: boolean): string => {
    const v = y[key] as number | null
    if (v === null || v === undefined) return '—'
    if (view === 'Raw') return per ? `${sym}${v.toFixed(2)}` : key === 'sharesDiluted' ? formatValue(v, 'shares') : formatValue(v, 'money', sym)
    if (view === 'Growth %') {
      const prev = years[idx + 1]?.[key] as number | null | undefined
      if (prev === null || prev === undefined || prev <= 0) return '—'
      const g = (v / prev - 1) * 100
      return `${g >= 0 ? '+' : ''}${g.toFixed(1)}%`
    }
    if (per || key === 'sharesDiluted') return '—'
    const base = y[BASE[stmt]] as number | null
    return base ? `${((v / base) * 100).toFixed(1)}%` : '—'
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <RangeTabs options={['Income statement', 'Balance sheet', 'Cash flow'] as Stmt[]} value={stmt} onChange={setStmt} />
        <RangeTabs options={['Raw', 'Growth %', 'Common-size %'] as View[]} value={view} onChange={setView} />
        <RangeTabs options={['Annual', 'Quarterly'] as ('Annual' | 'Quarterly')[]} value={period} onChange={setPeriod} />
        <span className="ml-auto text-xs text-fg-3">
          {currency} · fiscal years{demo && <span className="ml-2 font-semibold text-neu">DEMO DATA</span>}
          {view === 'Common-size %' && ` · % of ${stmt === 'Balance sheet' ? 'total assets' : 'revenue'}`}
        </span>
      </div>
      {period === 'Quarterly' ? (
        <div className="rounded-lg border border-dashed border-ink-600 p-6 text-sm text-fg-3">Quarterly statements require a connected data provider. Data unavailable in this dataset — nothing is estimated in its place.</div>
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-ink-850">Line item</th>
                {years.map((y) => (
                  <th key={y.fiscalYear} className="text-right">
                    FY{y.fiscalYear}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LINES[stmt].map((l) => (
                <tr key={l.key}>
                  <td className={clsx('sticky left-0 z-10 bg-ink-850', l.strong ? 'font-semibold text-fg' : 'text-fg-2')}>{l.label}</td>
                  {years.map((y, i) => (
                    <td key={y.fiscalYear} className={clsx('num text-right', l.strong && 'text-fg')}>
                      {cell(y, i, l.key, l.per)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
