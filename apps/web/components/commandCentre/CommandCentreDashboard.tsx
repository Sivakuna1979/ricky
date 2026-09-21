// @ts-nocheck
'use client'
// K2-K54 — the Command Centre. Every number shown here comes straight
// from /api/command-centre/*, which composes live from each phase's own
// authoritative functions (see lib/commandCentre/*) — nothing is cached
// or recomputed a second way here. K7: every "summary" is a list of
// factual components, never a single opaque score.
import { useEffect, useState } from 'react'
import { PRIORITY_META } from '@/lib/commandCentre/priority'

const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 14 }
const label = { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }
const kpiValue = { fontSize: 20, fontWeight: 800, color: '#111' }
const input = { padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }
const btn = { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }
const btnSecondary = { ...btn, background: '#f5f6fa', color: '#374151', border: '1px solid #e5e7eb' }
const money = (n: any) => `£${Number(n ?? 0).toFixed(2)}`

const TABS = [
  { key: 'today', label: 'Today' },
  { key: 'live', label: 'Live Ops' },
  { key: 'trends', label: 'Trends' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'goals', label: 'Goals & Budgets' },
]

function PriorityBadge({ priority }: { priority: string }) {
  const meta = PRIORITY_META[priority] ?? PRIORITY_META.INFO
  return <span style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}55`, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>{meta.label}</span>
}

function CoverageNote({ coverage, note }: { coverage?: string; note?: string }) {
  if (!coverage && !note) return null
  return <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{coverage ? `${coverage}. ` : ''}{note}</div>
}

function KpiCard({ title, value, sub }: any) {
  return (
    <div style={card}>
      <div style={label}>{title}</div>
      <div style={kpiValue}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function ComparisonLine({ name, comparison }: { name: string; comparison: any }) {
  if (!comparison) return null
  const up = comparison.delta_pct != null && comparison.delta_pct > 0
  const down = comparison.delta_pct != null && comparison.delta_pct < 0
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{name}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, color: '#111' }}>{typeof comparison.current === 'number' ? comparison.current : comparison.current}</span>
        {comparison.delta_pct != null ? (
          <span style={{ fontSize: 12, fontWeight: 800, color: up ? '#059669' : down ? '#dc2626' : '#6b7280' }}>{up ? '▲' : down ? '▼' : '–'} {Math.abs(comparison.delta_pct)}%</span>
        ) : (
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{comparison.note || comparison.coverage}</span>
        )}
      </span>
    </div>
  )
}

function ExceptionsList({ items, onAction }: any) {
  if (!items?.length) return <div style={{ ...card, color: '#6b7280', fontSize: 13 }}>Nothing needs attention right now.</div>
  return (
    <div>
      {items.map((e: any) => (
        <div key={e.dedupeKey} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <PriorityBadge priority={e.priority} />
                <span style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{e.title}</span>
              </div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>{e.detail}</div>
              {e.actionUrl && <a href={e.actionUrl} style={{ fontSize: 12, color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>Open →</a>}
            </div>
            {onAction && e.id && (
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => onAction(e.id, e.dedupeKey, 'acknowledge')} style={{ ...btnSecondary, padding: '6px 10px', fontSize: 11 }}>Acknowledge</button>
                <button onClick={() => onAction(e.id, e.dedupeKey, 'dismiss')} style={{ ...btnSecondary, padding: '6px 10px', fontSize: 11 }}>Dismiss</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function OpportunitiesList({ items }: any) {
  if (!items?.length) return <div style={{ ...card, color: '#6b7280', fontSize: 13 }}>No opportunities detected right now.</div>
  return (
    <div>
      {items.map((o: any) => (
        <div key={o.dedupeKey} style={{ ...card, borderLeft: '4px solid #059669' }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#111', marginBottom: 4 }}>💡 {o.title}</div>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>{o.why}</div>
          <div style={{ fontSize: 12, color: '#059669', fontWeight: 700, marginBottom: 4 }}>Possible action: {o.possibleAction}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Data period: {o.dataPeriod} · {o.dataCoverage}</div>
          {o.actionUrl && <a href={o.actionUrl} style={{ fontSize: 12, color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>Open →</a>}
        </div>
      ))}
    </div>
  )
}

function TodayTab() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')

  const load = () => fetch('/api/command-centre/overview').then(async (r) => {
    if (!r.ok) { setError((await r.json().catch(() => ({})))?.error ?? 'Failed to load'); return }
    setData(await r.json())
  }).catch(() => setError('Network error'))

  useEffect(() => { load() }, [])

  const handleAttentionAction = async (id: string, dedupeKey: string, action: 'acknowledge' | 'dismiss') => {
    await fetch(`/api/command-centre/attention/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }).catch(() => {})
    // Acknowledged items stay visible (just marked); dismissed items drop
    // out of this list immediately — the server itself never claims the
    // underlying issue is resolved just because it was dismissed.
    setData((d: any) => d ? { ...d, exceptions: action === 'dismiss' ? d.exceptions.filter((e: any) => e.dedupeKey !== dedupeKey) : d.exceptions.map((e: any) => e.dedupeKey === dedupeKey ? { ...e, state: 'ACKNOWLEDGED' } : e) } : d)
  }

  if (error) return <div style={{ ...card, color: '#dc2626' }}>{error}</div>
  if (!data) return <div style={{ color: '#6b7280' }}>Loading…</div>

  if (data.cold_start) {
    return (
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>🌱 Getting started</div>
        <div style={{ fontSize: 13, color: '#6b7280' }}>
          This business is {data.business_age_days} day(s) old — not enough trading history yet for reliable comparisons or trends. Once you've been trading a couple of weeks, this tab will show day-over-day comparisons and trend data automatically.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
        <KpiCard title="Revenue today" value={money(data.kpi_today.revenue)} />
        <KpiCard title="Orders today" value={data.kpi_today.orders} />
        <KpiCard title="Average order" value={money(data.kpi_today.average_order_value)} />
        <KpiCard title="Gross contribution" value={money(data.kpi_today.known_gross_contribution)} sub={`${data.kpi_today.cogs_coverage_pct}% cost coverage`} />
        <KpiCard title="Wastage" value={money(data.kpi_today.wastage_cost)} />
        <KpiCard title="New / returning" value={`${data.kpi_today.new_customers} / ${data.kpi_today.returning_customers}`} />
      </div>

      {data.revenue_vs_comparable_day && (
        <div style={card}>
          <div style={label}>Revenue vs comparable day{data.revenue_vs_comparable_day.comparable_dates?.length ? ` (${data.revenue_vs_comparable_day.comparable_dates.length} comparable days)` : ''}</div>
          <ComparisonLine name="Revenue" comparison={data.revenue_vs_comparable_day} />
          <CoverageNote coverage={data.revenue_vs_comparable_day.coverage} note={data.revenue_vs_comparable_day.note} />
        </div>
      )}

      <div style={{ fontWeight: 800, fontSize: 15, margin: '20px 0 10px' }}>⚠️ Needs attention ({data.exceptions.length})</div>
      <ExceptionsList items={data.exceptions} onAction={handleAttentionAction} />

      <div style={{ fontWeight: 800, fontSize: 15, margin: '20px 0 10px' }}>💡 Opportunities</div>
      <OpportunitiesList items={data.opportunities} />
    </div>
  )
}

function LiveOpsTab() {
  const [data, setData] = useState<any>(null)
  useEffect(() => { fetch('/api/command-centre/overview').then((r) => r.json()).then(setData).catch(() => {}) }, [])
  if (!data) return <div style={{ color: '#6b7280' }}>Loading…</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
      {data.vans.map((v: any) => (
        <div key={v.van_id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{v.van_name}</div>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 20, background: v.trading_status === 'LIVE_NOW' ? '#05966918' : '#6b728018', color: v.trading_status === 'LIVE_NOW' ? '#059669' : '#6b7280' }}>
              {v.trading_status.replace('_', ' ')}
            </span>
          </div>
          {v.current_stop && <div style={{ fontSize: 12, color: '#374151' }}>📍 Currently at {v.current_stop.location_name}</div>}
          {!v.current_stop && v.next_stop && <div style={{ fontSize: 12, color: '#374151' }}>📍 Next: {v.next_stop.location_name}</div>}
          <div style={{ fontSize: 12, color: v.gps.fresh ? '#059669' : '#9ca3af', marginTop: 4 }}>
            {v.gps.recorded_at ? (v.gps.fresh ? `Live GPS (${v.gps.age_seconds}s ago)` : `Last known GPS (${Math.round(v.gps.age_seconds / 60)}m ago)`) : 'No GPS data'}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 10, fontSize: 12, color: '#374151' }}>
            <div><b>{v.orders_today.count}</b> orders</div>
            <div><b>{money(v.orders_today.revenue)}</b></div>
            <div><b>{v.orders_today.preparing}</b> preparing</div>
            <div><b>{v.orders_today.ready}</b> ready</div>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
            {v.staff_working_today} staff on shift · Hygiene checklist: {v.hygiene_opening_checklist_done ? '✅ done' : '⏳ not yet'}
            {v.vehicle_fields_due_soon.length > 0 && <span style={{ color: '#dc2626' }}> · {v.vehicle_fields_due_soon.length} vehicle doc(s) due</span>}
          </div>
        </div>
      ))}
      {!data.vans.length && <div style={{ color: '#6b7280' }}>No vans to show.</div>}
    </div>
  )
}

function TrendsTab() {
  const [period, setPeriod] = useState('week')
  const [data, setData] = useState<any>(null)
  useEffect(() => { fetch(`/api/command-centre/comparisons?period=${period}`).then((r) => r.json()).then(setData).catch(() => {}) }, [period])

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {['week', 'month'].map((p) => (
          <button key={p} onClick={() => setPeriod(p)} style={period === p ? btn : btnSecondary}>{p === 'week' ? 'This week vs last week' : 'This month vs last month'}</button>
        ))}
      </div>
      {data ? (
        <div style={card}>
          <div style={label}>{data.current_period.label} vs {data.prior_period.label}</div>
          <ComparisonLine name="Revenue" comparison={data.comparisons.revenue} />
          <ComparisonLine name="Orders" comparison={data.comparisons.orders} />
          <ComparisonLine name="Average order value" comparison={data.comparisons.average_order_value} />
          <ComparisonLine name="Gross contribution" comparison={data.comparisons.known_gross_contribution} />
          <ComparisonLine name="Expenses" comparison={data.comparisons.recorded_expenses} />
          <ComparisonLine name="Wastage" comparison={data.comparisons.wastage_cost} />
          <ComparisonLine name="Repeat purchase rate" comparison={data.comparisons.repeat_purchase_rate_pct} />
        </div>
      ) : <div style={{ color: '#6b7280' }}>Loading…</div>}
    </div>
  )
}

function TomorrowTab() {
  const [data, setData] = useState<any>(null)
  useEffect(() => { fetch('/api/command-centre/tomorrow').then((r) => r.json()).then(setData).catch(() => {}) }, [])
  if (!data) return <div style={{ color: '#6b7280' }}>Loading…</div>

  return (
    <div>
      {(data.confirmed_events?.length > 0 || data.expected_deliveries?.length > 0) && (
        <div style={card}>
          <div style={label}>Tomorrow ({data.target_date})</div>
          {data.confirmed_events?.map((e: any) => <div key={e.id} style={{ fontSize: 13, marginBottom: 4 }}>🎪 Confirmed event: {e.event_requests?.event_name}</div>)}
          {data.expected_deliveries?.map((d: any) => <div key={d.id} style={{ fontSize: 13, marginBottom: 4 }}>🚚 Delivery expected from {d.supplier_records?.name}</div>)}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        {data.vans.map((v: any) => (
          <div key={v.van_id} style={card}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8 }}>{v.van_name}</div>
            <div style={{ fontSize: 13, marginBottom: 4 }}>{v.route.scheduled ? `📍 ${v.route.stops.length} stop(s) scheduled` : '⚪ Not scheduled to trade'}</div>
            {v.route.scheduled && (
              <>
                <div style={{ fontSize: 13, marginBottom: 4, color: v.staffing.assigned ? '#059669' : '#dc2626' }}>{v.staffing.assigned ? `✅ Staffed: ${v.staffing.staff.join(', ')}` : '⚠️ No staff assigned yet'}</div>
                <div style={{ fontSize: 13, marginBottom: 4, color: v.stock_plan.shortfalls.length ? '#dc2626' : '#059669' }}>
                  {v.stock_plan.shortfalls.length ? `⚠️ ${v.stock_plan.shortfalls.length} item(s) short: ${v.stock_plan.shortfalls.map((s: any) => s.item_name).join(', ')}` : '✅ Stock plan looks covered'}
                </div>
                <div style={{ fontSize: 13, marginBottom: 4, color: v.vehicle.docs_ok === false ? '#dc2626' : '#6b7280' }}>
                  {v.vehicle.docs_ok === false ? '⚠️ A vehicle document has expired' : v.vehicle.docs_ok == null ? 'No vehicle record on file' : '✅ Vehicle docs ok'}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function PricingTab() {
  const [prices, setPrices] = useState<any>(null)
  const [margin, setMargin] = useState<any>(null)
  const [simItem, setSimItem] = useState('')
  const [simPrice, setSimPrice] = useState('')
  const [simResult, setSimResult] = useState<any>(null)

  useEffect(() => {
    fetch('/api/command-centre/supplier-prices').then((r) => r.json()).then(setPrices).catch(() => {})
    fetch('/api/command-centre/margin').then((r) => r.json()).then(setMargin).catch(() => {})
  }, [])

  const runSimulator = async () => {
    if (!simItem || !simPrice) return
    const res = await fetch(`/api/command-centre/price-simulator?menu_item_id=${simItem}&proposed_price=${simPrice}`)
    setSimResult(res.ok ? await res.json() : null)
  }

  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: 15, margin: '0 0 10px' }}>Supplier price changes</div>
      {prices?.price_changes?.length ? prices.price_changes.map((p: any) => (
        <div key={p.stock_item_id} style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700 }}>{p.name}{p.supplier ? ` — ${p.supplier}` : ''}</span>
            <span style={{ fontWeight: 800, color: p.change_pct > 0 ? '#dc2626' : '#059669' }}>{p.change_pct != null ? `${p.change_pct > 0 ? '+' : ''}${p.change_pct}%` : '–'}</span>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{money(p.previous_cost)} ({p.previous_date?.slice(0, 10)}) → {money(p.latest_cost)} ({p.latest_date?.slice(0, 10)})</div>
        </div>
      )) : <div style={{ ...card, color: '#6b7280', fontSize: 13 }}>No confirmed supplier price history yet — this builds up as purchase orders are received.</div>}

      <div style={{ fontWeight: 800, fontSize: 15, margin: '20px 0 10px' }}>Menu margin review {margin ? `(${margin.coverage_pct}% cost coverage)` : ''}</div>
      {margin?.items?.length ? (
        <div style={card}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ textAlign: 'left', color: '#888', fontSize: 11 }}><th>Item</th><th>Price</th><th>Cost</th><th>Contribution</th><th>Coverage</th></tr></thead>
            <tbody>
              {margin.items.map((i: any) => (
                <tr key={i.menu_item_id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '6px 0' }}>{i.name}<button onClick={() => setSimItem(i.menu_item_id)} style={{ marginLeft: 8, fontSize: 10, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>Simulate →</button></td>
                  <td>{money(i.selling_price)}</td>
                  <td>{i.known_cost != null ? money(i.known_cost) : '–'}</td>
                  <td>{i.known_gross_contribution != null ? `${money(i.known_gross_contribution)} (${i.margin_pct}%)` : '–'}</td>
                  <td style={{ fontSize: 11, color: i.cost_coverage === 'FULL' ? '#059669' : '#9ca3af' }}>{i.cost_coverage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div style={{ ...card, color: '#6b7280', fontSize: 13 }}>No menu items found.</div>}

      <div style={{ fontWeight: 800, fontSize: 15, margin: '20px 0 10px' }}>Price simulator</div>
      <div style={card}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <input placeholder="Menu item id (use Simulate → above)" value={simItem} onChange={(e) => setSimItem(e.target.value)} style={{ ...input, flex: 1, minWidth: 200 }} />
          <input placeholder="Proposed price" type="number" step="0.01" value={simPrice} onChange={(e) => setSimPrice(e.target.value)} style={{ ...input, width: 120 }} />
          <button onClick={runSimulator} style={btn}>Calculate</button>
        </div>
        {simResult && (
          <div style={{ fontSize: 13 }}>
            <div>Current: {money(simResult.current_price)} → Proposed: {money(simResult.proposed_price)}</div>
            <div>Contribution: {simResult.current_gross_contribution != null ? money(simResult.current_gross_contribution) : '–'} → {simResult.proposed_gross_contribution != null ? money(simResult.proposed_gross_contribution) : '–'} ({simResult.contribution_difference != null ? (simResult.contribution_difference >= 0 ? '+' : '') + money(simResult.contribution_difference) : 'no known cost'})</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>{simResult.disclosure}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function GoalsBudgetsTab() {
  const [goals, setGoals] = useState<any>(null)
  const [budgets, setBudgets] = useState<any>(null)
  const [goalType, setGoalType] = useState('revenue')
  const [goalValue, setGoalValue] = useState('')
  const [budgetCategory, setBudgetCategory] = useState('revenue')
  const [budgetValue, setBudgetValue] = useState('')

  const loadGoals = () => fetch('/api/command-centre/goals').then((r) => r.json()).then((d) => setGoals(d.goals)).catch(() => {})
  const loadBudgets = () => fetch('/api/command-centre/budgets').then((r) => r.json()).then(setBudgets).catch(() => {})
  useEffect(() => { loadGoals(); loadBudgets() }, [])

  const saveGoal = async () => {
    if (!goalValue) return
    await fetch('/api/command-centre/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goal_type: goalType, target_value: Number(goalValue) }) })
    setGoalValue(''); loadGoals()
  }
  const saveBudget = async () => {
    if (!budgetValue) return
    const periodStart = `${new Date().toISOString().slice(0, 7)}-01`
    await fetch('/api/command-centre/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: budgetCategory, period_start: periodStart, budgeted_amount: Number(budgetValue) }) })
    setBudgetValue(''); loadBudgets()
  }

  return (
    <div>
      <div style={{ fontWeight: 800, fontSize: 15, margin: '0 0 10px' }}>Goals</div>
      <div style={card}>
        {(goals ?? []).map((g: any) => (
          <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
            <span>{g.goal_type.replace(/_/g, ' ')}</span><span style={{ fontWeight: 700 }}>{g.target_value} ({g.period})</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <select value={goalType} onChange={(e) => setGoalType(e.target.value)} style={input}>
            {['revenue', 'wastage_ceiling_pct', 'hygiene_completion_pct', 'stockout_count_ceiling', 'repeat_customer_rate_pct'].map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
          <input placeholder="Target value" type="number" value={goalValue} onChange={(e) => setGoalValue(e.target.value)} style={{ ...input, width: 140 }} />
          <button onClick={saveGoal} style={btn}>Set goal</button>
        </div>
      </div>

      <div style={{ fontWeight: 800, fontSize: 15, margin: '20px 0 10px' }}>Budgets — {budgets?.period_start}</div>
      <div style={card}>
        {(budgets?.budgets ?? []).map((b: any) => (
          <div key={b.category} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
              <span>{b.category.replace(/_/g, ' ')}</span>
              <span>{b.budgeted_amount != null ? money(b.budgeted_amount) : 'No budget set'}</span>
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Recorded actual: {money(b.recorded_actual)}{b.committed != null ? ` · Committed: ${money(b.committed)}` : ''}{b.unpaid != null ? ` · Unpaid: ${money(b.unpaid)}` : ''}
              {b.variance != null && <span style={{ color: b.variance > 0 ? '#dc2626' : '#059669', fontWeight: 700 }}> · Variance: {b.variance >= 0 ? '+' : ''}{money(b.variance)}</span>}
            </div>
            {b.note && <div style={{ fontSize: 11, color: '#9ca3af' }}>{b.note}</div>}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <select value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value)} style={input}>
            {['revenue', 'stock_purchasing', 'vehicle_maintenance', 'marketing'].map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
          <input placeholder="Budgeted amount" type="number" value={budgetValue} onChange={(e) => setBudgetValue(e.target.value)} style={{ ...input, width: 140 }} />
          <button onClick={saveBudget} style={btn}>Set budget</button>
        </div>
      </div>
    </div>
  )
}

function SearchBar() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return }
    const t = setTimeout(() => {
      fetch(`/api/command-centre/search?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((d) => setResults(d.results ?? [])).catch(() => {})
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <input
        value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="🔍 Search vans, stops, stock, suppliers, staff, vehicles, equipment, notes…" aria-label="Command centre search"
        style={{ ...input, width: '100%', boxSizing: 'border-box', padding: '10px 14px' }}
      />
      {open && results.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, marginTop: 4, boxShadow: '0 4px 14px rgba(0,0,0,0.08)', zIndex: 10, maxHeight: 320, overflowY: 'auto' }}>
          {results.map((r: any, i: number) => (
            <a key={i} href={r.url} style={{ display: 'block', padding: '8px 14px', fontSize: 13, color: '#111', textDecoration: 'none', borderBottom: '1px solid #f3f4f6' }}>
              <span style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', marginRight: 8 }}>{r.type}</span>{r.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export function CommandCentreDashboard() {
  const [tab, setTab] = useState('today')
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <a href="/dashboard/command-centre/report" style={{ fontSize: 12, color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>📄 Owner report →</a>
      </div>
      <SearchBar />
      <div role="tablist" aria-label="Command Centre sections" style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            style={{ flexShrink: 0, padding: '8px 14px', borderRadius: '10px 10px 0 0', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: tab === t.key ? '#f0fdf4' : 'transparent', color: tab === t.key ? '#059669' : '#6b7280' }}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'today' && <TodayTab />}
      {tab === 'live' && <LiveOpsTab />}
      {tab === 'trends' && <TrendsTab />}
      {tab === 'tomorrow' && <TomorrowTab />}
      {tab === 'pricing' && <PricingTab />}
      {tab === 'goals' && <GoalsBudgetsTab />}
    </div>
  )
}
