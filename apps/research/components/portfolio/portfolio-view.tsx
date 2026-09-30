'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { AlertTriangle, Info, Lock, Plus, Trash2 } from 'lucide-react'
import { userActions, useUserData } from '@/components/user/store'
import { analysePortfolio, type PricedHolding } from '@/lib/portfolio/analytics'
import type { UniverseRow } from '@/lib/screener/universe'
import { formatValue } from '@/components/charts/chart-kit'
import { ScoreRing } from '@/components/ui/score'

const money = (v: number) => formatValue(v, 'money')
const COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#9085e9']

function Split({ title, rows }: { title: string; rows: { name: string; weight: number }[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-fg">{title}</h3>
      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.name}>
            <div className="mb-0.5 flex justify-between text-xs">
              <span className="text-fg-2">{r.name}</span>
              <span className="num text-fg">{r.weight.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-ink-750">
              <div className="h-2 rounded-full" style={{ width: `${r.weight}%`, background: i < 5 ? COLORS[i] : '#3b4d73' }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PortfolioView({ universe, analytics, maxPortfolios }: { universe: UniverseRow[]; analytics: boolean; maxPortfolios: number }) {
  const { ready, backend, data, error } = useUserData()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [form, setForm] = useState({ ticker: '', quantity: '', price: '', date: '' })
  const [newName, setNewName] = useState('')
  const active = data.portfolios.find((p) => p.id === activeId) ?? data.portfolios[0]

  const a = useMemo(() => {
    if (!active) return null
    const priced: PricedHolding[] = active.holdings.map((h) => {
      const u = universe.find((r) => r.ticker === h.ticker)
      return {
        id: h.id,
        ticker: h.ticker,
        name: u?.name ?? h.ticker,
        sector: u?.sector ?? 'Unknown',
        country: u?.country ?? 'Unknown',
        quantity: h.quantity,
        purchasePrice: h.purchasePrice,
        price: u?.price ?? null,
        dividendYield: u?.dividendYield ?? null,
        score: u?.scores.overall ?? null,
        scoreKind: u ? u.scores.kind : null,
      }
    })
    return analysePortfolio(priced)
  }, [active, universe])

  if (!ready) return <div className="card card-pad text-sm text-fg-3">Loading your portfolios…</div>

  const addHolding = () => {
    if (!active) return
    const q = Number(form.quantity)
    const p = Number(form.price)
    if (!form.ticker || !(q > 0) || !(p >= 0)) return
    void userActions.addHolding(active.id, { ticker: form.ticker, quantity: q, purchasePrice: p, purchasedAt: form.date || undefined })
    setForm({ ticker: '', quantity: '', price: '', date: '' })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-fg-3">
        <span className={clsx('chip', backend === 'cloud' ? 'border-pos/40 text-pos' : 'border-neu/40 text-neu')}>{backend === 'cloud' ? 'Synced to your account' : 'Saved in this browser only'}</span>
        {error && <span className="text-neg">{error}</span>}
      </div>

      <div className="card card-pad flex flex-wrap items-center gap-2">
        {data.portfolios.map((p) => (
          <button key={p.id} type="button" onClick={() => setActiveId(p.id)} className={clsx('chip py-1 text-sm', p.id === active?.id ? 'border-accent/50 bg-accent-soft text-accent' : 'border-ink-600 text-fg-2')}>
            {p.name}
          </button>
        ))}
        {data.portfolios.length < maxPortfolios ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void userActions.addPortfolio(newName || `Portfolio ${data.portfolios.length + 1}`)
              setNewName('')
            }}
          >
            <input className="input w-44" placeholder="New portfolio name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={60} />
            <button className="btn">
              <Plus className="h-4 w-4" /> Create
            </button>
          </form>
        ) : (
          <span className="text-xs text-fg-4">Portfolio limit for your plan reached.</span>
        )}
        {active && (
          <button type="button" className="ml-auto text-xs text-fg-4 hover:text-neg" onClick={() => confirm(`Delete “${active.name}”?`) && userActions.removePortfolio(active.id)}>
            Delete portfolio
          </button>
        )}
      </div>

      {!active ? (
        <div className="card card-pad text-sm text-fg-3">Create a portfolio to start tracking holdings.</div>
      ) : (
        <>
          <div className="card card-pad">
            <h2 className="mb-3 font-semibold text-fg">Add holding</h2>
            <form
              className="grid gap-2 sm:grid-cols-5"
              onSubmit={(e) => {
                e.preventDefault()
                addHolding()
              }}
            >
              <input className="input" list="pf-tickers" placeholder="Ticker" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })} maxLength={10} required />
              <datalist id="pf-tickers">
                {universe.map((u) => (
                  <option key={u.ticker} value={u.ticker}>
                    {u.name}
                  </option>
                ))}
              </datalist>
              <input className="input num" inputMode="decimal" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
              <input className="input num" inputMode="decimal" placeholder="Purchase price ($)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <button className="btn btn-primary justify-center">
                <Plus className="h-4 w-4" /> Add
              </button>
            </form>
          </div>

          {a && a.positions.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ['Current value', money(a.value)],
                  ['Cost basis', money(a.cost)],
                  ['Profit / loss', `${a.pnl >= 0 ? '+' : '−'}${money(Math.abs(a.pnl))}${a.pnlPct !== null ? ` (${a.pnlPct >= 0 ? '+' : ''}${a.pnlPct.toFixed(1)}%)` : ''}`],
                  ['Est. annual dividend income', money(a.dividendIncome)],
                ].map(([k, v]) => (
                  <div key={k} className="card p-4">
                    <div className="label">{k}</div>
                    <div className={clsx('num mt-1 text-xl font-semibold', k === 'Profit / loss' ? (a.pnl >= 0 ? 'text-pos' : 'text-neg') : 'text-fg')}>{v}</div>
                  </div>
                ))}
              </div>

              <div className="card card-pad">
                <h2 className="mb-3 font-semibold text-fg">Holdings</h2>
                <div className="scrollbar-thin overflow-x-auto">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Holding</th>
                        <th className="text-right">Quantity</th>
                        <th className="text-right">Purchase price</th>
                        <th className="text-right">Current price</th>
                        <th className="text-right">Value</th>
                        <th className="text-right">P/L</th>
                        <th className="text-right">Allocation</th>
                        <th className="text-right">Quality score</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {a.positions.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <Link href={`/company/${p.ticker}`} className="font-semibold text-fg hover:text-accent">
                              {p.ticker}
                            </Link>
                            <div className="text-xs text-fg-3">{p.name}</div>
                          </td>
                          <td className="num text-right">{p.quantity}</td>
                          <td className="num text-right">${p.purchasePrice.toFixed(2)}</td>
                          <td className="num text-right">{p.price === null ? <span className="text-xs text-fg-4">unavailable</span> : `$${p.price.toFixed(2)}`}</td>
                          <td className="num text-right text-fg">{money(p.value)}</td>
                          <td className={clsx('num text-right', p.pnlPct === null ? 'text-fg-4' : p.pnl >= 0 ? 'text-pos' : 'text-neg')}>{p.pnlPct === null ? '—' : `${p.pnlPct >= 0 ? '+' : ''}${p.pnlPct.toFixed(1)}%`}</td>
                          <td className="num text-right">{p.weight.toFixed(1)}%</td>
                          <td className="num text-right">
                            {p.score ?? '—'} {p.scoreKind && <span className="text-[10px] text-fg-4">{p.scoreKind}</span>}
                          </td>
                          <td>
                            <button type="button" aria-label={`Remove ${p.ticker}`} className="text-fg-4 hover:text-neg" onClick={() => userActions.removeHolding(active.id, p.id)}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-fg-4">Current prices come from the demo dataset until a quote provider is connected.</p>
              </div>

              {analytics ? (
                <div className="card card-pad">
                  <h2 className="mb-4 font-semibold text-fg">Portfolio analytics</h2>
                  <div className="grid gap-6 lg:grid-cols-[200px_1fr_1fr]">
                    <div className="flex flex-col items-center gap-1">
                      <ScoreRing score={a.qualityScore} size={120} label="Portfolio quality score" />
                      <span className="text-center text-[11px] text-fg-4">Value-weighted; covers {a.qualityCoverage.toFixed(0)}% of value</span>
                    </div>
                    <Split title="Sector allocation" rows={a.bySector} />
                    <Split title="Country allocation" rows={a.byCountry} />
                  </div>
                  <div className="mt-6">
                    <h3 className="mb-2 text-sm font-semibold text-fg">Risk concentration</h3>
                    {a.warnings.length ? (
                      <ul className="space-y-2">
                        {a.warnings.map((w) => (
                          <li key={w.text} className={clsx('flex gap-2 rounded-lg border p-2.5 text-sm', w.level === 'warn' ? 'border-neu/30 bg-neu-soft' : 'border-ink-700')}>
                            {w.level === 'warn' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-neu" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />}
                            <span className="text-fg-2">{w.text}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-fg-3">No concentration thresholds exceeded.</p>
                    )}
                    <p className="mt-3 text-xs text-fg-4">These observations describe the portfolio’s data. They are not recommendations to buy, sell or rebalance.</p>
                  </div>
                </div>
              ) : (
                <div className="card card-pad flex items-center gap-3 text-sm text-fg-3">
                  <Lock className="h-4 w-4 text-neu" /> Sector/country allocation, concentration analysis and portfolio quality score are part of Professional.{' '}
                  <Link href="/pricing" className="text-accent hover:underline">
                    See plans
                  </Link>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
