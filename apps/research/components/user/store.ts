'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { supabaseBrowser } from '@/lib/auth/browser'
import type { AlertKind, AlertRule } from '@/lib/alerts/rules'

export interface Holding {
  id: string
  ticker: string
  quantity: number
  purchasePrice: number
  purchasedAt?: string
}
export interface Portfolio {
  id: string
  name: string
  holdings: Holding[]
}
export interface UserData {
  watchlist: string[]
  portfolios: Portfolio[]
  alerts: AlertRule[]
}
interface State {
  ready: boolean
  backend: 'local' | 'cloud'
  data: UserData
  error: string | null
}

const KEY = 'evidentia:user-data:v1'
const EMPTY: UserData = { watchlist: [], portfolios: [], alerts: [] }
let state: State = { ready: false, backend: 'local', data: EMPTY, error: null }
const listeners = new Set<() => void>()
let userId: string | null = null
let watchlistId: string | null = null
let initStarted = false

const emit = () => listeners.forEach((l) => l())
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  emit()
}
const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)

function readLocal(): UserData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const d = JSON.parse(raw) as Partial<UserData>
    return { watchlist: Array.isArray(d.watchlist) ? d.watchlist : [], portfolios: Array.isArray(d.portfolios) ? d.portfolios : [], alerts: Array.isArray(d.alerts) ? d.alerts : [] }
  } catch {
    return EMPTY
  }
}
function writeLocal(d: UserData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    /* storage unavailable (private mode) — data lives for this session only */
  }
}

async function init() {
  if (initStarted) return
  initStarted = true
  const sb = supabaseBrowser()
  if (sb) {
    const { data: auth } = await sb.auth.getUser()
    if (auth.user) {
      userId = auth.user.id
      try {
        await loadCloud()
        return
      } catch (e) {
        set({ error: e instanceof Error ? e.message : 'Could not load your saved data' })
      }
    }
  }
  set({ ready: true, backend: 'local', data: readLocal() })
}

async function loadCloud() {
  const sb = supabaseBrowser()!
  let { data: wls } = await sb.from('watchlists').select('id').order('created_at').limit(1)
  if (!wls?.length) {
    const ins = await sb.from('watchlists').insert({ user_id: userId, name: 'Watchlist' }).select('id')
    wls = ins.data ?? []
  }
  watchlistId = wls[0]?.id ?? null
  const [items, ports, holds, alerts] = await Promise.all([
    watchlistId ? sb.from('watchlist_items').select('ticker').eq('watchlist_id', watchlistId) : Promise.resolve({ data: [] as { ticker: string }[] }),
    sb.from('portfolios').select('id,name').order('created_at'),
    sb.from('portfolio_holdings').select('id,portfolio_id,ticker,quantity,purchase_price,purchased_at'),
    sb.from('alerts').select('id,ticker,kind,params,active'),
  ])
  const portfolios: Portfolio[] = (ports.data ?? []).map((p: { id: string; name: string }) => ({
    id: p.id,
    name: p.name,
    holdings: (holds.data ?? [])
      .filter((h: { portfolio_id: string }) => h.portfolio_id === p.id)
      .map((h: { id: string; ticker: string; quantity: number; purchase_price: number; purchased_at: string | null }) => ({
        id: h.id,
        ticker: h.ticker,
        quantity: Number(h.quantity),
        purchasePrice: Number(h.purchase_price),
        purchasedAt: h.purchased_at ?? undefined,
      })),
  }))
  set({
    ready: true,
    backend: 'cloud',
    data: {
      watchlist: (items.data ?? []).map((i: { ticker: string }) => i.ticker),
      portfolios,
      alerts: (alerts.data ?? []).map((a: { id: string; ticker: string; kind: AlertKind; params: { value?: number }; active: boolean }) => ({ id: a.id, ticker: a.ticker, kind: a.kind, value: a.params?.value, active: a.active })),
    },
  })
}

/** Apply a mutation locally, persist, and mirror to Supabase when signed in. */
async function mutate(next: UserData, cloud?: () => PromiseLike<{ error: { message: string } | null }>) {
  const prev = state.data
  set({ data: next, error: null })
  if (state.backend === 'local') return writeLocal(next)
  if (cloud) {
    const { error } = await cloud()
    if (error) set({ data: prev, error: error.message })
  }
}

const valid = (t: string) => /^[A-Z0-9][A-Z0-9.\-]{0,9}$/.test(t)

export const userActions = {
  toggleWatch(ticker: string) {
    const t = ticker.toUpperCase()
    if (!valid(t)) return
    const d = state.data
    const on = d.watchlist.includes(t)
    const sb = supabaseBrowser()
    return mutate(
      { ...d, watchlist: on ? d.watchlist.filter((x) => x !== t) : [...d.watchlist, t] },
      sb && watchlistId ? () => (on ? sb.from('watchlist_items').delete().eq('watchlist_id', watchlistId).eq('ticker', t) : sb.from('watchlist_items').insert({ watchlist_id: watchlistId, ticker: t })) : undefined,
    )
  },
  addPortfolio(name: string) {
    const p: Portfolio = { id: uid(), name: name.trim().slice(0, 60) || 'Portfolio', holdings: [] }
    const sb = supabaseBrowser()
    return mutate({ ...state.data, portfolios: [...state.data.portfolios, p] }, sb ? () => sb.from('portfolios').insert({ id: p.id, user_id: userId, name: p.name }) : undefined)
  },
  removePortfolio(id: string) {
    const sb = supabaseBrowser()
    return mutate({ ...state.data, portfolios: state.data.portfolios.filter((p) => p.id !== id) }, sb ? () => sb.from('portfolios').delete().eq('id', id) : undefined)
  },
  addHolding(portfolioId: string, h: Omit<Holding, 'id'>) {
    const t = h.ticker.toUpperCase()
    if (!valid(t) || !(h.quantity > 0) || !(h.purchasePrice >= 0)) return
    const holding: Holding = { ...h, ticker: t, id: uid() }
    const sb = supabaseBrowser()
    return mutate(
      { ...state.data, portfolios: state.data.portfolios.map((p) => (p.id === portfolioId ? { ...p, holdings: [...p.holdings, holding] } : p)) },
      sb
        ? () =>
            sb.from('portfolio_holdings').insert({ id: holding.id, portfolio_id: portfolioId, ticker: t, quantity: h.quantity, purchase_price: h.purchasePrice, purchased_at: h.purchasedAt || null })
        : undefined,
    )
  },
  removeHolding(portfolioId: string, holdingId: string) {
    const sb = supabaseBrowser()
    return mutate(
      { ...state.data, portfolios: state.data.portfolios.map((p) => (p.id === portfolioId ? { ...p, holdings: p.holdings.filter((h) => h.id !== holdingId) } : p)) },
      sb ? () => sb.from('portfolio_holdings').delete().eq('id', holdingId) : undefined,
    )
  },
  addAlert(a: Omit<AlertRule, 'id' | 'active'>) {
    const t = a.ticker.toUpperCase()
    if (!valid(t)) return
    const rule: AlertRule = { ...a, ticker: t, id: uid(), active: true }
    const sb = supabaseBrowser()
    return mutate({ ...state.data, alerts: [...state.data.alerts, rule] }, sb ? () => sb.from('alerts').insert({ id: rule.id, user_id: userId, ticker: t, kind: rule.kind, params: { value: rule.value }, active: true }) : undefined)
  },
  removeAlert(id: string) {
    const sb = supabaseBrowser()
    return mutate({ ...state.data, alerts: state.data.alerts.filter((a) => a.id !== id) }, sb ? () => sb.from('alerts').delete().eq('id', id) : undefined)
  },
}

export function useUserData() {
  useEffect(() => {
    void init()
  }, [])
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
    () => state,
  )
}
