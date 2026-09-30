'use client'

import { useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { Bell, Trash2 } from 'lucide-react'
import { userActions, useUserData } from '@/components/user/store'
import { ALERT_KINDS, evaluateAlert, type AlertKind } from '@/lib/alerts/rules'
import type { UniverseRow } from '@/lib/screener/universe'
import { formatValue } from '@/components/charts/chart-kit'

const STATE_CLS = { triggered: 'border-pos/40 bg-pos-soft text-pos', watching: 'border-ink-600 text-fg-3', no_data: 'border-ink-600 text-fg-4', awaiting_feed: 'border-neu/40 text-neu' }
const STATE_WORD = { triggered: 'Triggered', watching: 'Watching', no_data: 'No data', awaiting_feed: 'Awaiting feed' }

export function WatchlistView({ universe, alertsEnabled }: { universe: UniverseRow[]; alertsEnabled: boolean }) {
  const { ready, backend, data, error } = useUserData()
  const [add, setAdd] = useState('')
  const [rule, setRule] = useState<{ ticker: string; kind: AlertKind; value: string }>({ ticker: '', kind: 'price_below', value: '' })
  if (!ready) return <div className="card card-pad text-sm text-fg-3">Loading…</div>
  const row = (t: string) => universe.find((u) => u.ticker === t)
  const kindDef = ALERT_KINDS.find((k) => k.kind === rule.kind)!

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={clsx('chip', backend === 'cloud' ? 'border-pos/40 text-pos' : 'border-neu/40 text-neu')}>{backend === 'cloud' ? 'Synced to your account' : 'Saved in this browser only'}</span>
        {error && <span className="text-neg">{error}</span>}
      </div>
      <div className="card card-pad">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-fg">Watchlist ({data.watchlist.length})</h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (add) void userActions.toggleWatch(add)
              setAdd('')
            }}
          >
            <input list="wl-tickers" className="input w-40" placeholder="Add ticker…" value={add} onChange={(e) => setAdd(e.target.value.toUpperCase())} maxLength={10} />
            <datalist id="wl-tickers">
              {universe.map((u) => (
                <option key={u.ticker} value={u.ticker}>
                  {u.name}
                </option>
              ))}
            </datalist>
            <button className="btn">Add</button>
          </form>
        </div>
        {data.watchlist.length === 0 ? (
          <p className="text-sm text-fg-3">Nothing saved yet. Use the Watchlist button on any company page, or add a ticker above.</p>
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Company</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Mkt cap</th>
                  <th className="text-right">P/E</th>
                  <th className="text-right">ROIC</th>
                  <th className="text-right">Valuation</th>
                  <th className="text-right">Quality score</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.watchlist.map((t) => {
                  const r = row(t)
                  return (
                    <tr key={t}>
                      <td>
                        <Link href={`/company/${t}`} className="font-semibold text-fg hover:text-accent">
                          {t}
                        </Link>
                        <div className="text-xs text-fg-3">{r?.name ?? 'No data in current dataset'}</div>
                      </td>
                      <td className="num text-right">{r?.price ? `$${r.price.toFixed(2)}` : '—'}</td>
                      <td className="num text-right">{r?.marketCap ? formatValue(r.marketCap, 'money') : '—'}</td>
                      <td className="num text-right">{r?.pe ? `${r.pe.toFixed(1)}×` : '—'}</td>
                      <td className="num text-right">{r?.roic ? `${r.roic.toFixed(0)}%` : '—'}</td>
                      <td className="num text-right">{r?.scores.valuation ?? '—'}</td>
                      <td className="num text-right">
                        {r?.scores.overall ?? '—'} {r && <span className="text-[10px] text-fg-4">{r.scores.kind}</span>}
                      </td>
                      <td>
                        <button type="button" aria-label={`Remove ${t}`} className="text-fg-4 hover:text-neg" onClick={() => userActions.toggleWatch(t)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card card-pad" id="alerts">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-fg">
          <Bell className="h-4 w-4" /> Alerts
        </h2>
        <p className="mb-4 text-sm text-fg-3">
          Price, valuation and score alerts are checked against current data now{alertsEnabled ? ' and by the scheduled alert job for delivery' : ''}. Event alerts activate when their data feed is connected.
        </p>
        <form
          className="mb-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!rule.ticker) return
            if (kindDef.needsValue && !Number.isFinite(Number(rule.value))) return
            void userActions.addAlert({ ticker: rule.ticker, kind: rule.kind, value: kindDef.needsValue ? Number(rule.value) : undefined })
            setRule({ ...rule, value: '' })
          }}
        >
          <input list="wl-tickers" className="input w-32" placeholder="Ticker" value={rule.ticker} onChange={(e) => setRule({ ...rule, ticker: e.target.value.toUpperCase() })} maxLength={10} required />
          <select className="input w-auto" value={rule.kind} onChange={(e) => setRule({ ...rule, kind: e.target.value as AlertKind })}>
            {ALERT_KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
          {kindDef.needsValue && <input className="input num w-28" inputMode="decimal" placeholder={kindDef.unit ?? 'value'} value={rule.value} onChange={(e) => setRule({ ...rule, value: e.target.value })} required />}
          <button className="btn btn-primary">Create alert</button>
        </form>
        {data.alerts.length === 0 ? (
          <p className="text-sm text-fg-4">No alerts yet.</p>
        ) : (
          <ul className="divide-y divide-ink-750 rounded-lg border border-ink-700">
            {data.alerts.map((al) => {
              const r = row(al.ticker)
              const st = evaluateAlert(al, { price: r?.price, pe: r?.pe, score: r?.scores.overall, changePct: null })
              const def = ALERT_KINDS.find((k) => k.kind === al.kind)!
              return (
                <li key={al.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    <span className="font-semibold text-fg">{al.ticker}</span> <span className="text-fg-2">{def.label}</span>
                    {al.value !== undefined && (
                      <span className="num text-fg">
                        {' '}
                        {def.unit === '$' ? '$' : ''}
                        {al.value}
                        {def.unit && def.unit !== '$' ? def.unit : ''}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-fg-4">{st.detail}</span>
                    <span className={clsx('chip', STATE_CLS[st.state])}>{STATE_WORD[st.state]}</span>
                    <button type="button" aria-label="Delete alert" className="text-fg-4 hover:text-neg" onClick={() => userActions.removeAlert(al.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
