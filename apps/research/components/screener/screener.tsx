'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { Download, Lock, Plus, Sparkles, X } from 'lucide-react'
import type { UniverseRow } from '@/lib/screener/universe'
import { applyFilters, describeFilter, FIELDS, fieldDef, parseQuery, readField, type Filter, type NumericField, type TextField } from '@/lib/screener/filters'
import { formatValue } from '@/components/charts/chart-kit'

const EXAMPLE = 'Find profitable companies with ROIC above 15%, revenue growth above 10%, positive FCF and reasonable valuation'

const COLUMNS: { key: NumericField; label: string }[] = [
  { key: 'marketCap', label: 'Mkt cap' },
  { key: 'revenueGrowth', label: 'Rev. growth' },
  { key: 'pe', label: 'P/E' },
  { key: 'peg', label: 'PEG' },
  { key: 'evToEbitda', label: 'EV/EBITDA' },
  { key: 'fcfYield', label: 'FCF yield' },
  { key: 'roic', label: 'ROIC' },
  { key: 'operatingMargin', label: 'Op. margin' },
  { key: 'debtToEquity', label: 'D/E' },
  { key: 'dividendYield', label: 'Div. yield' },
  { key: 'score.valuation', label: 'Valuation' },
  { key: 'score.overall', label: 'Quality score' },
]

function fmt(v: number | null, f: NumericField) {
  if (v === null) return '—'
  const u = fieldDef(f).unit
  if (u === '$B') return formatValue(v * 1e9, 'money')
  if (u === '%') return `${v.toFixed(1)}%`
  if (u === '×') return `${v.toFixed(1)}×`
  return Math.round(v).toString()
}

export function Screener({ rows, advanced, maxFilters, canExport }: { rows: UniverseRow[]; advanced: boolean; maxFilters: number; canExport: boolean }) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<Filter[]>([])
  const [unparsed, setUnparsed] = useState<string[]>([])
  const [sort, setSort] = useState<{ key: NumericField; dir: 1 | -1 }>({ key: 'score.overall', dir: -1 })
  const [draft, setDraft] = useState<{ field: NumericField; op: 'gt' | 'lt'; value: string }>({ field: 'pe', op: 'lt', value: '25' })
  const [notice, setNotice] = useState<string | null>(null)

  const texts: Record<TextField, string[]> = useMemo(() => {
    const uniq = (k: TextField) => [...new Set(rows.map((r) => r[k]).filter(Boolean))].sort()
    return { sector: uniq('sector'), industry: uniq('industry'), country: uniq('country'), exchange: uniq('exchange') }
  }, [rows])

  const results = useMemo(() => {
    const out = applyFilters(rows, filters)
    return [...out].sort((a, b) => {
      const va = readField(a, sort.key)
      const vb = readField(b, sort.key)
      if (va === null) return 1
      if (vb === null) return -1
      return (va - vb) * sort.dir
    })
  }, [rows, filters, sort])

  const add = (fs: Filter[]) => {
    const next = [...filters, ...fs]
    if (next.length > maxFilters) {
      setNotice(`Your plan allows ${maxFilters} filters. Upgrade for the advanced screener.`)
      return
    }
    setNotice(null)
    setFilters(next)
  }

  const translate = () => {
    const r = parseQuery(query)
    setUnparsed(r.unparsed)
    const allowed = advanced ? r.filters : r.filters.filter((f) => f.kind === 'text' || !fieldDef(f.field).advanced)
    if (allowed.length < r.filters.length) setNotice('Some filters need the advanced screener (Premium) and were skipped.')
    setFilters([])
    if (allowed.length > maxFilters) {
      setNotice(`Your plan allows ${maxFilters} filters.`)
      setFilters(allowed.slice(0, maxFilters))
    } else setFilters(allowed)
  }

  const toggleText = (field: TextField, value: string) => {
    const existing = filters.find((f): f is Extract<Filter, { kind: 'text' }> => f.kind === 'text' && f.field === field)
    if (!existing) return add([{ kind: 'text', field, values: [value] }])
    const values = existing.values.includes(value) ? existing.values.filter((v) => v !== value) : [...existing.values, value]
    setFilters(filters.map((f) => (f === existing ? { ...existing, values } : f)).filter((f) => f.kind !== 'text' || f.values.length))
  }

  const exportCsv = () => {
    const cols = ['ticker', 'name', 'sector', 'industry', 'exchange', 'country', ...COLUMNS.map((c) => c.key)]
    const lines = [cols.join(',')]
    for (const r of results) {
      lines.push(
        [r.ticker, r.name, r.sector, r.industry, r.exchange, r.country, ...COLUMNS.map((c) => readField(r, c.key) ?? '')]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      )
    }
    const blob = new Blob([`# Evidentia screener export — DEMO DATA, not verified\n${lines.join('\n')}`], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'evidentia-screen.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-5">
      <div className="card card-pad">
        <label className="label mb-2 block" htmlFor="nlq">
          Describe what you are looking for
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="nlq" className="input" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && translate()} placeholder={EXAMPLE} maxLength={300} />
          <button type="button" className="btn btn-primary shrink-0 justify-center" onClick={translate} disabled={!query.trim()}>
            <Sparkles className="h-4 w-4" /> Translate to filters
          </button>
        </div>
        <button type="button" className="mt-2 text-xs text-accent hover:underline" onClick={() => setQuery(EXAMPLE)}>
          Try the example
        </button>
        <p className="mt-1 text-xs text-fg-4">Plain English is converted by transparent rules into the filter chips below — check and edit them before relying on the results. Nothing is decided by a hidden model.</p>
        {unparsed.length > 0 && <p className="mt-2 text-xs text-neu">Not understood (ignored): {unparsed.map((u) => `“${u}”`).join(', ')}</p>}
      </div>

      <div className="card card-pad space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label mr-1">Active filters</span>
          {filters.length === 0 && <span className="text-sm text-fg-4">None — showing the whole universe</span>}
          {filters.map((f, i) => (
            <span key={i} className="chip border-accent/40 bg-accent-soft text-accent" title={f.source ? `From: “${f.source}”` : undefined}>
              {describeFilter(f)}
              <button type="button" aria-label="Remove filter" onClick={() => setFilters(filters.filter((_, k) => k !== i))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {filters.length > 0 && (
            <button type="button" className="text-xs text-fg-3 hover:text-fg" onClick={() => setFilters([])}>
              Clear all
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <select className="input w-auto" value={draft.field} onChange={(e) => setDraft({ ...draft, field: e.target.value as NumericField })}>
            {FIELDS.map((f) => (
              <option key={f.key} value={f.key} disabled={f.advanced && !advanced}>
                {f.group} · {f.label}
                {f.advanced && !advanced ? ' (Premium)' : ''}
              </option>
            ))}
          </select>
          <select className="input w-auto" value={draft.op} onChange={(e) => setDraft({ ...draft, op: e.target.value as 'gt' | 'lt' })}>
            <option value="gt">above</option>
            <option value="lt">below</option>
          </select>
          <input className="input num w-28" inputMode="decimal" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} />
          <span className="pb-2 text-xs text-fg-3">{fieldDef(draft.field).unit === '$B' ? '$ billions' : fieldDef(draft.field).unit}</span>
          <button type="button" className="btn" onClick={() => Number.isFinite(Number(draft.value)) && draft.value !== '' && add([{ kind: 'num', field: draft.field, op: draft.op, value: Number(draft.value) }])}>
            <Plus className="h-4 w-4" /> Add filter
          </button>
        </div>
        {(['sector', 'exchange', 'country'] as TextField[]).map((field) => (
          <div key={field} className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="label mr-1 w-16 capitalize">{field}</span>
            {texts[field].map((v) => {
              const on = filters.some((f) => f.kind === 'text' && f.field === field && f.values.includes(v))
              return (
                <button key={v} type="button" aria-pressed={on} onClick={() => toggleText(field, v)} className={clsx('chip', on ? 'border-accent/50 bg-accent-soft text-accent' : 'border-ink-600 text-fg-3 hover:text-fg')}>
                  {v}
                </button>
              )
            })}
          </div>
        ))}
        {notice && (
          <p className="flex items-center gap-2 text-sm text-neu">
            <Lock className="h-4 w-4" /> {notice}{' '}
            <Link href="/pricing" className="text-accent hover:underline">
              See plans
            </Link>
          </p>
        )}
      </div>

      <div className="card card-pad">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-fg">
            {results.length} of {rows.length} companies match
          </h2>
          <button type="button" className="btn" onClick={exportCsv} disabled={!canExport} title={canExport ? 'Download CSV' : 'Advanced export is a Professional feature'}>
            {canExport ? <Download className="h-4 w-4" /> : <Lock className="h-4 w-4" />} Export CSV
          </button>
        </div>
        <div className="scrollbar-thin overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-ink-850">Company</th>
                <th>Sector</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="text-right">
                    <button type="button" className="uppercase hover:text-fg" onClick={() => setSort({ key: c.key, dir: sort.key === c.key ? (sort.dir === 1 ? -1 : 1) : -1 })}>
                      {c.label} {sort.key === c.key ? (sort.dir === -1 ? '↓' : '↑') : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.ticker}>
                  <td className="sticky left-0 z-10 bg-ink-850">
                    <Link href={`/company/${r.ticker}`} className="font-semibold text-fg hover:text-accent">
                      {r.ticker}
                    </Link>
                    <div className="max-w-[160px] truncate text-xs text-fg-3">{r.name}</div>
                  </td>
                  <td className="text-xs">{r.sector}</td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="num text-right">
                      {fmt(readField(r, c.key), c.key)}
                      {c.key === 'score.overall' && <span className="ml-1 text-[10px] text-fg-4">{r.scores.kind === 'full' ? 'full' : 'snapshot'}</span>}
                    </td>
                  ))}
                </tr>
              ))}
              {results.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length + 2} className="py-6 text-center text-fg-3">
                    No companies match. Companies with missing data for a filtered metric are excluded rather than assumed to pass.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-fg-4">
          “full” = Investment Quality Score from the complete methodology. “snapshot” = the same curves applied to headline metrics only (lower confidence). All rows are DEMO DATA until a live provider is connected.
        </p>
      </div>
    </div>
  )
}
