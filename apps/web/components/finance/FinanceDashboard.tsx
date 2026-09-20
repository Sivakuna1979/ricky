// @ts-nocheck
'use client'
// H4–H6 — Finance dashboard. Every number shown here comes from the same
// lib/finance/* functions the AI finance tools use (see
// lib/ai/tools/finance.ts) — the dashboard and the AI can never disagree.
import { useEffect, useState } from 'react'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'suppliers', label: 'Supplier Invoices' },
  { key: 'cash', label: 'Cash & Card' },
  { key: 'vat', label: 'VAT' },
  { key: 'reports', label: 'Reports' },
  { key: 'exports', label: 'Exports' },
]
const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' }, { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This week' }, { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' }, { value: 'last_month', label: 'Last month' },
]

export const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 14 }
export const label = { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }
export const kpiValue = { fontSize: 20, fontWeight: 800, color: '#111' }
export const input = { padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }
export const btn = { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }
export const btnSecondary = { ...btn, background: '#f5f6fa', color: '#374151', border: '1px solid #e5e7eb' }

export function money(n: any, currency = 'GBP') {
  const symbol = currency === 'GBP' ? '£' : currency + ' '
  return `${symbol}${Number(n ?? 0).toFixed(2)}`
}

export function FinanceDashboard({ vans, suppliers, currency }: { vans: { id: string; name: string }[]; suppliers: { id: string; supplier_name: string }[]; currency: string }) {
  const [tab, setTab] = useState('overview')
  const [vanId, setVanId] = useState('')
  const [range, setRange] = useState('this_week')

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={label}>Van</div>
          <select value={vanId} onChange={e => setVanId(e.target.value)} style={input}>
            <option value="">All vans</option>
            {vans.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <div style={label}>Period</div>
          <select value={range} onChange={e => setRange(e.target.value)} style={input}>
            {RANGE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e5e7eb', background: tab === t.key ? '#ecfdf5' : '#fff', color: tab === t.key ? '#059669' : '#555', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{t.label}</button>
          ))}
        </div>
      </div>

      {tab === 'overview' && <OverviewTab vanId={vanId} range={range} currency={currency} />}
      {tab === 'expenses' && <ExpensesTab vanId={vanId} suppliers={suppliers} currency={currency} />}
      {tab === 'suppliers' && <SupplierInvoicesTab suppliers={suppliers} currency={currency} />}
      {tab === 'cash' && <CashCardTab vans={vans} currency={currency} />}
      {tab === 'vat' && <VatTab range={range} currency={currency} />}
      {tab === 'reports' && <ReportsTab vans={vans} range={range} currency={currency} />}
      {tab === 'exports' && <ExportsTab />}
    </div>
  )
}

function OverviewTab({ vanId, range, currency }: any) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ range })
    if (vanId) params.set('van_id', vanId)
    fetch(`/api/finance/overview?${params}`).then(r => r.json()).then(d => { setData(d); setLoading(false) })
  }, [vanId, range])

  if (loading) return <div style={{ fontSize: 13, color: '#888' }}>Loading…</div>
  if (!data) return null

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 14 }}>
        <div style={card}><div style={label}>Net revenue</div><div style={kpiValue}>{money(data.sales?.net_revenue, currency)}</div></div>
        <div style={card}><div style={label}>Orders</div><div style={kpiValue}>{data.sales?.orders ?? 0}</div></div>
        <div style={card}><div style={label}>Gross contribution</div><div style={kpiValue}>{money(data.cogs?.gross_contribution, currency)}</div></div>
        <div style={card}><div style={label}>Expenses</div><div style={kpiValue}>{money(data.expenses?.total_gross, currency)}</div></div>
        <div style={card}><div style={label}>Vehicle + equipment</div><div style={kpiValue}>{money((data.vehicle_costs ?? 0) + (data.equipment_costs ?? 0), currency)}</div></div>
        <div style={card}><div style={label}>Review items</div><div style={{ ...kpiValue, color: data.open_review_items > 0 ? '#dc2626' : '#111' }}>{data.open_review_items}</div></div>
      </div>

      {data.sales?.refunds > 0 && <div style={{ ...card, background: '#fef3c7', border: '1px solid #f59e0b' }}>Refunds this period: {money(data.sales.refunds, currency)} (already subtracted from net revenue above — gross was {money(data.sales.gross_revenue, currency)}).</div>}

      {data.cogs?.note && <div style={{ ...card, fontSize: 12, color: '#888' }}>{data.cogs.note} Coverage: {data.cogs.coverage_pct}% of revenue has a known cost.</div>}

      {data.sales?.by_payment_category && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Sales by payment type</div>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead><tr style={{ textAlign: 'left', color: '#888' }}><th>Type</th><th>Revenue</th><th>Orders</th></tr></thead>
            <tbody>
              {Object.entries(data.sales.by_payment_category).map(([k, v]: any) => (
                <tr key={k} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '4px 0' }}>{k === 'cash' ? 'Cash' : k === 'card_recorded' ? 'Card (recorded — not verified)' : k === 'verified_online' ? 'Verified online' : 'Other'}</td>
                  <td>{money(v.revenue, currency)}</td><td>{v.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ExpensesTab({ vanId, suppliers, currency }: any) {
  const [expenses, setExpenses] = useState<any[]>([])
  const [form, setForm] = useState<any>({ expense_date: new Date().toISOString().slice(0, 10), category: 'other', net_amount: '', vat_amount: '0', payment_method: 'cash' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [documentId, setDocumentId] = useState<string | null>(null)

  const load = () => fetch(`/api/finance/expenses${vanId ? `?van_id=${vanId}` : ''}`).then(r => r.json()).then(d => setExpenses(Array.isArray(d) ? d : []))
  useEffect(() => { load() }, [vanId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePhoto = async (file: File) => {
    setExtracting(true); setError('')
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      try {
        const res = await fetch('/api/finance/documents/extract', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64, mediaType: file.type, source_kind: 'receipt' }) })
        const data = await res.json()
        if (data.error) { setError(data.error); setExtracting(false); return }
        setDocumentId(data.document_id)
        const e = data.extracted ?? {}
        setForm((f: any) => ({
          ...f,
          description: e.supplier_name ? `${e.supplier_name} receipt` : f.description,
          category: e.suggested_category ?? f.category,
          expense_date: e.date ?? f.expense_date,
          net_amount: e.net_amount != null ? String(e.net_amount) : (e.gross_amount != null ? String(e.gross_amount) : f.net_amount),
          vat_amount: e.vat_amount != null ? String(e.vat_amount) : '0',
        }))
      } catch { setError('Could not read this receipt — enter the details manually.') }
      setExtracting(false)
    }
    reader.readAsDataURL(file)
  }

  const submit = async () => {
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/finance/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, net_amount: Number(form.net_amount), vat_amount: Number(form.vat_amount || 0), van_id: form.van_id || undefined, supplier_id: form.supplier_id || undefined, document_id: documentId || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm({ expense_date: new Date().toISOString().slice(0, 10), category: 'other', net_amount: '', vat_amount: '0', payment_method: 'cash' })
      setDocumentId(null)
      load()
    } catch (e: any) { setError(e.message ?? 'Could not save expense') }
    setSaving(false)
  }

  return (
    <div>
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Add expense</div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ ...btnSecondary, display: 'inline-block' }}>
            {extracting ? 'Reading receipt…' : '📷 Scan a receipt'}
            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} disabled={extracting} onChange={e => e.target.files?.[0] && handlePhoto(e.target.files[0])} />
          </label>
          {documentId && <span style={{ fontSize: 11, color: '#059669', marginLeft: 8 }}>Fields below filled from the receipt — review before saving.</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
          <input placeholder="Description" value={form.description ?? ''} onChange={e => setForm({ ...form, description: e.target.value })} style={input} />
          <input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} style={input} />
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={input}>
            {['food_stock', 'drinks', 'packaging', 'fuel', 'vehicle', 'repairs', 'equipment', 'insurance', 'rent_storage', 'phone_internet', 'marketing', 'staff', 'cleaning', 'professional_fees', 'other'].map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
          </select>
          <select value={form.supplier_id ?? ''} onChange={e => setForm({ ...form, supplier_id: e.target.value })} style={input}>
            <option value="">No supplier</option>
            {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
          </select>
          <input type="number" step="0.01" placeholder="Net" value={form.net_amount} onChange={e => setForm({ ...form, net_amount: e.target.value })} style={input} />
          <input type="number" step="0.01" placeholder="VAT" value={form.vat_amount} onChange={e => setForm({ ...form, vat_amount: e.target.value })} style={input} />
          <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} style={input}>
            {['cash', 'card', 'bank_transfer', 'other'].map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
          </select>
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{error}</div>}
        <button onClick={submit} disabled={saving || !form.description || !form.net_amount} style={{ ...btn, marginTop: 10, opacity: saving || !form.description || !form.net_amount ? 0.5 : 1 }}>{saving ? 'Saving…' : 'Save expense'}</button>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Recent expenses</div>
        {expenses.length === 0 && <div style={{ fontSize: 12, color: '#888' }}>No expenses recorded yet.</div>}
        {expenses.map(e => (
          <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #f3f4f6', fontSize: 12, opacity: e.status === 'VOID' ? 0.5 : 1 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{e.description} {e.status === 'VOID' && '(void)'}</div>
              <div style={{ color: '#888' }}>{e.expense_date} · {e.category.replace('_', ' ')} {e.supplier_records?.supplier_name ? `· ${e.supplier_records.supplier_name}` : ''} {e.vans?.name ? `· ${e.vans.name}` : ''}</div>
            </div>
            <div style={{ fontWeight: 700 }}>{money(e.gross_amount, currency)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SupplierInvoicesTab({ suppliers, currency }: any) {
  const [invoices, setInvoices] = useState<any[]>([])
  const [form, setForm] = useState<any>({ invoice_date: new Date().toISOString().slice(0, 10), net_amount: '', vat_amount: '0' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [payAmount, setPayAmount] = useState<Record<string, string>>({})

  const load = () => fetch('/api/finance/supplier-invoices').then(r => r.json()).then(d => setInvoices(Array.isArray(d) ? d : []))
  useEffect(() => { load() }, [])

  const submit = async () => {
    if (!form.supplier_id || !form.net_amount) return
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/finance/supplier-invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, net_amount: Number(form.net_amount), vat_amount: Number(form.vat_amount || 0) }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm({ invoice_date: new Date().toISOString().slice(0, 10), net_amount: '', vat_amount: '0' })
      load()
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  const recordPayment = async (id: string) => {
    const amount = Number(payAmount[id])
    if (!amount) return
    const res = await fetch(`/api/finance/supplier-invoices/${id}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error); return }
    setPayAmount(p => ({ ...p, [id]: '' }))
    load()
  }

  return (
    <div>
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Log a supplier invoice</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
          <select value={form.supplier_id ?? ''} onChange={e => setForm({ ...form, supplier_id: e.target.value })} style={input}>
            <option value="">Select supplier</option>
            {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
          </select>
          <input placeholder="Invoice number" value={form.invoice_number ?? ''} onChange={e => setForm({ ...form, invoice_number: e.target.value })} style={input} />
          <input type="date" value={form.invoice_date} onChange={e => setForm({ ...form, invoice_date: e.target.value })} style={input} />
          <input type="date" placeholder="Due date" value={form.due_date ?? ''} onChange={e => setForm({ ...form, due_date: e.target.value })} style={input} />
          <input type="number" step="0.01" placeholder="Net" value={form.net_amount} onChange={e => setForm({ ...form, net_amount: e.target.value })} style={input} />
          <input type="number" step="0.01" placeholder="VAT" value={form.vat_amount} onChange={e => setForm({ ...form, vat_amount: e.target.value })} style={input} />
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{error}</div>}
        <button onClick={submit} disabled={saving} style={{ ...btn, marginTop: 10 }}>{saving ? 'Saving…' : 'Log invoice'}</button>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Invoices</div>
        {invoices.map(i => (
          <div key={i.id} style={{ padding: '8px 0', borderTop: '1px solid #f3f4f6', fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div><strong>{i.supplier_records?.supplier_name}</strong> {i.invoice_number ? `· ${i.invoice_number}` : ''} · {i.invoice_date}</div>
              <span style={{ fontWeight: 700, padding: '2px 8px', borderRadius: 12, fontSize: 10, background: i.status === 'PAID' ? '#ecfdf5' : i.status === 'PARTIALLY_PAID' ? '#fff7ed' : '#fef2f2', color: i.status === 'PAID' ? '#059669' : i.status === 'PARTIALLY_PAID' ? '#f97316' : '#dc2626' }}>{i.status}</span>
            </div>
            <div style={{ color: '#888', marginTop: 2 }}>Gross {money(i.gross_amount, currency)} · Paid {money(i.amount_paid, currency)} · Outstanding {money(i.outstanding_balance, currency)}</div>
            {i.status !== 'PAID' && i.status !== 'VOID' && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <input type="number" step="0.01" placeholder="Payment amount" value={payAmount[i.id] ?? ''} onChange={e => setPayAmount(p => ({ ...p, [i.id]: e.target.value }))} style={{ ...input, width: 140 }} />
                <button onClick={() => recordPayment(i.id)} style={{ ...btnSecondary, fontSize: 11, padding: '6px 10px' }}>Record payment</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function CashCardTab({ vans, currency }: any) {
  const [vanId, setVanId] = useState(vans[0]?.id ?? '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [openingFloat, setOpeningFloat] = useState('0')
  const [actualCash, setActualCash] = useState('')
  const [externalTotal, setExternalTotal] = useState('')
  const [provider, setProvider] = useState('')
  const [result, setResult] = useState<any>(null)
  const [cardResult, setCardResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => { fetch(`/api/finance/cash${vanId ? `?van_id=${vanId}` : ''}`).then(r => r.json()).then(d => setHistory(Array.isArray(d) ? d : [])) }, [vanId, result])

  const submitCash = async () => {
    setError('')
    const res = await fetch('/api/finance/cash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ van_id: vanId, service_date: date, opening_float: Number(openingFloat), actual_cash: Number(actualCash) }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error); return }
    setResult(data)
  }
  const submitCard = async () => {
    setError('')
    const res = await fetch('/api/finance/card', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ van_id: vanId, service_date: date, external_terminal_total: externalTotal ? Number(externalTotal) : undefined, provider: provider || undefined }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error); return }
    setCardResult(data)
  }

  return (
    <div>
      <div style={card}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <select value={vanId} onChange={e => setVanId(e.target.value)} style={input}>{vans.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={input} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Cash count</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input type="number" step="0.01" placeholder="Opening float" value={openingFloat} onChange={e => setOpeningFloat(e.target.value)} style={input} />
          <input type="number" step="0.01" placeholder="Actual cash counted" value={actualCash} onChange={e => setActualCash(e.target.value)} style={input} />
          <button onClick={submitCash} disabled={!actualCash} style={btn}>Record cash count</button>
        </div>
        {result && (
          <div style={{ marginTop: 10, fontSize: 12 }}>
            Expected {money(result.expected_cash, currency)} (float {money(result.opening_float, currency)} + cash sales {money(result.cash_sales_recorded, currency)} − refunds {money(result.cash_refunds_recorded, currency)} − cash expenses {money(result.recorded_cash_expenses, currency)}) vs actual {money(result.actual_cash, currency)}.
            <div style={{ fontWeight: 800, color: Math.abs(result.variance) < 0.01 ? '#059669' : '#dc2626' }}>Variance: {money(result.variance, currency)}</div>
          </div>
        )}

        <div style={{ fontWeight: 700, fontSize: 13, margin: '16px 0 6px' }}>Card reconciliation</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Provider (SumUp, Square...)" value={provider} onChange={e => setProvider(e.target.value)} style={input} />
          <input type="number" step="0.01" placeholder="External terminal total" value={externalTotal} onChange={e => setExternalTotal(e.target.value)} style={input} />
          <button onClick={submitCard} style={btnSecondary}>Record card reconciliation</button>
        </div>
        {cardResult && (
          <div style={{ marginTop: 10, fontSize: 12 }}>
            FoodTaxi card-recorded (not verified/settled): {money(cardResult.foodtaxi_card_recorded_total, currency)}
            {cardResult.external_terminal_total != null && <div>vs external terminal total {money(cardResult.external_terminal_total, currency)} — variance {money(cardResult.variance, currency)}</div>}
          </div>
        )}
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{error}</div>}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Cash count history</div>
        {history.map(h => (
          <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #f3f4f6', fontSize: 12 }}>
            <div>{h.service_date} · {h.vans?.name}</div>
            <div style={{ fontWeight: 700, color: Math.abs(h.variance) < 0.01 ? '#059669' : '#dc2626' }}>{money(h.variance, currency)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function VatTab({ range, currency }: any) {
  const [settings, setSettings] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const load = () => fetch(`/api/finance/vat?range=${range}`).then(r => r.json()).then(setSummary)
  useEffect(() => { load() }, [range]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (summary) setSettings({ is_registered: summary.is_registered, vat_number: summary.vat_number, default_rate: summary.default_rate }) }, [summary])

  const save = async () => {
    setSaving(true)
    await fetch('/api/finance/vat', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
    setSaving(false)
    load()
  }

  if (!summary) return <div style={{ fontSize: 13, color: '#888' }}>Loading…</div>

  return (
    <div>
      <div style={{ ...card, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
        This is a FoodTaxi record summary for review — not a filed VAT return. Nothing here is submitted to HMRC.
      </div>
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>VAT settings</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8 }}>
          <input type="checkbox" checked={!!settings?.is_registered} onChange={e => setSettings({ ...settings, is_registered: e.target.checked })} /> VAT registered
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="VAT number" value={settings?.vat_number ?? ''} onChange={e => setSettings({ ...settings, vat_number: e.target.value })} style={input} />
          <input type="number" step="0.01" placeholder="Default rate %" value={settings?.default_rate ?? ''} onChange={e => setSettings({ ...settings, default_rate: e.target.value })} style={input} />
          <button onClick={save} disabled={saving} style={btn}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Recorded VAT — {summary.period?.label}</div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div><div style={label}>Output VAT</div><div style={kpiValue}>{money(summary.output_vat, currency)}</div></div>
          <div><div style={label}>Input VAT</div><div style={kpiValue}>{money(summary.input_vat, currency)}</div></div>
          <div><div style={label}>{summary.label}</div><div style={kpiValue}>{money(Math.abs(summary.difference), currency)}</div></div>
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 10 }}>{summary.note}</div>
      </div>
    </div>
  )
}

function ReportsTab({ vans, range, currency }: any) {
  const [report, setReport] = useState<any>(null)
  const [vanId, setVanId] = useState('')
  const [vanReport, setVanReport] = useState<any>(null)

  useEffect(() => { fetch(`/api/finance/reports?type=management&range=${range}`).then(r => r.json()).then(setReport) }, [range])
  useEffect(() => { if (vanId) fetch(`/api/finance/reports?type=van&van_id=${vanId}&range=${range}`).then(r => r.json()).then(setVanReport); else setVanReport(null) }, [vanId, range])

  if (!report) return <div style={{ fontSize: 13, color: '#888' }}>Loading…</div>

  return (
    <div>
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Management report — {report.period?.start} to {report.period?.end}</div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 10 }}>{report.disclosure}</div>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={{ padding: '4px 0' }}>Sales (net revenue)</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{money(report.sales_net_revenue, currency)}</td></tr>
            <tr><td style={{ padding: '4px 0' }}>Known COGS</td><td style={{ textAlign: 'right' }}>−{money(report.known_cogs, currency)}</td></tr>
            <tr style={{ borderTop: '1px solid #f3f4f6' }}><td style={{ padding: '4px 0', fontWeight: 700 }}>Gross contribution ({report.cogs_coverage_pct}% cost coverage)</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{money(report.gross_contribution, currency)}</td></tr>
            <tr><td style={{ padding: '4px 0' }}>Recorded operating expenses</td><td style={{ textAlign: 'right' }}>−{money(report.recorded_operating_expenses, currency)}</td></tr>
            <tr style={{ borderTop: '2px solid #e5e7eb' }}><td style={{ padding: '6px 0', fontWeight: 800 }}>Recorded operating result</td><td style={{ textAlign: 'right', fontWeight: 800 }}>{money(report.recorded_operating_result, currency)}</td></tr>
          </tbody>
        </table>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Van finance</div>
        <select value={vanId} onChange={e => setVanId(e.target.value)} style={input}>
          <option value="">Select a van</option>
          {vans.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        {vanReport && (
          <div style={{ marginTop: 10, fontSize: 12 }}>
            <div>Revenue: {money(vanReport.revenue, currency)} ({vanReport.orders} orders)</div>
            <div>Gross contribution: {money(vanReport.gross_contribution, currency)} ({vanReport.cogs_coverage_pct}% coverage)</div>
            <div>Vehicle cost: {money(vanReport.vehicle_cost, currency)} · Equipment cost: {money(vanReport.equipment_cost, currency)}</div>
            <div style={{ fontWeight: 700, marginTop: 4 }}>Estimated gross contribution after vehicle/equipment: {money(vanReport.estimated_gross_contribution_after_vehicle_equipment, currency)}</div>
          </div>
        )}
      </div>
    </div>
  )
}

const EXPORT_TYPES = [
  { type: 'sales', label: 'Sales' }, { type: 'expenses', label: 'Expenses' },
  { type: 'supplier_invoices', label: 'Supplier invoices' }, { type: 'payments', label: 'Payments' },
  { type: 'refunds', label: 'Refunds' }, { type: 'cash', label: 'Cash reconciliation' },
  { type: 'vat', label: 'VAT summary' }, { type: 'cogs', label: 'COGS summary' },
]

function ExportsTab() {
  const [start, setStart] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10))
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10))

  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Accountant export centre</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input type="date" value={start} onChange={e => setStart(e.target.value)} style={input} />
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={input} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {EXPORT_TYPES.map(t => (
          <a key={t.type} href={`/api/finance/export?type=${t.type}&start=${start}&end=${end}`} style={{ ...btnSecondary, textDecoration: 'none', display: 'inline-block' }}>⬇ {t.label} CSV</a>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 12 }}>CSV only, custom date range. Sales exports never include customer names, emails or phone numbers.</div>
    </div>
  )
}
