// @ts-nocheck
'use client'
// I4/I54 — every number here comes from the same lib/crm/* functions the
// AI CRM tools use (see lib/ai/tools/crm.ts) — the dashboard and the AI
// can never disagree.
import { useEffect, useState } from 'react'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'customers', label: 'Customers' },
  { key: 'loyalty', label: 'Loyalty' },
  { key: 'promotions', label: 'Promotions' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'reviews', label: 'Reviews' },
]

const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 14 }
const label = { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }
const kpiValue = { fontSize: 20, fontWeight: 800, color: '#111' }
const input = { padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }
const btn = { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }
const btnSecondary = { ...btn, background: '#f5f6fa', color: '#374151', border: '1px solid #e5e7eb' }

function money(n: any, currency = 'GBP') { return `${currency === 'GBP' ? '£' : currency + ' '}${Number(n ?? 0).toFixed(2)}` }

export function CrmDashboard({ vans, currency }: { vans: { id: string; name: string }[]; currency: string }) {
  const [tab, setTab] = useState('overview')
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: tab === t.key ? '#f5f3ff' : '#fff', color: tab === t.key ? '#7c3aed' : '#555', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{t.label}</button>
        ))}
      </div>
      {tab === 'overview' && <OverviewTab currency={currency} />}
      {tab === 'customers' && <CustomersTab currency={currency} />}
      {tab === 'loyalty' && <LoyaltyTab />}
      {tab === 'promotions' && <PromotionsTab vans={vans} currency={currency} />}
      {tab === 'campaigns' && <CampaignsTab />}
      {tab === 'reviews' && <ReviewsTab vans={vans} />}
    </div>
  )
}

function OverviewTab({ currency }: any) {
  const [data, setData] = useState<any>(null)
  useEffect(() => { fetch('/api/crm/dashboard').then(r => r.json()).then(setData) }, [])
  if (!data) return <div style={{ fontSize: 13, color: '#888' }}>Loading…</div>
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 14 }}>
        <div style={card}><div style={label}>Active customers</div><div style={kpiValue}>{data.active_customers}</div></div>
        <div style={card}><div style={label}>New this month</div><div style={kpiValue}>{data.new_this_month}</div></div>
        <div style={card}><div style={label}>Returning</div><div style={kpiValue}>{data.returning_customers}</div></div>
        <div style={card}><div style={label}>Lapsed</div><div style={kpiValue}>{data.lapsed_customers}</div></div>
        <div style={card}><div style={label}>Repeat rate</div><div style={kpiValue}>{data.repeat_purchase_rate_pct}%</div></div>
        <div style={card}><div style={label}>Loyalty members</div><div style={kpiValue}>{data.loyalty_members}</div></div>
        <div style={card}><div style={label}>Rewards redeemed</div><div style={kpiValue}>{data.rewards_redeemed}</div></div>
        <div style={card}><div style={label}>Avg rating</div><div style={kpiValue}>{data.reviews.average_rating ?? '—'} {data.reviews.count ? `(${data.reviews.count})` : ''}</div></div>
      </div>
      {data.recent_campaigns?.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Recent campaigns</div>
          {data.recent_campaigns.map((c: any) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #f3f4f6', fontSize: 12 }}>
              <span>{c.name}</span><span style={{ color: '#888' }}>{c.status} · ~{c.estimated_recipients} recipients</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CustomersTab({ currency }: any) {
  const [customers, setCustomers] = useState<any[]>([])
  const [segment, setSegment] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)

  const load = () => {
    const params = new URLSearchParams({ segment })
    if (search) params.set('search', search)
    fetch(`/api/crm/customers?${params}`).then(r => r.json()).then(d => setCustomers(d.customers ?? []))
  }
  useEffect(() => { load() }, [segment]) // eslint-disable-line react-hooks/exhaustive-deps

  const openProfile = (id: string) => fetch(`/api/crm/customers/${id}`).then(r => r.json()).then(setSelected)

  if (selected) return <CustomerProfile customer={selected} currency={currency} onBack={() => setSelected(null)} />

  return (
    <div>
      <div style={{ ...card, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input placeholder="Search name/phone/email" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} style={{ ...input, flex: 1, minWidth: 160 }} />
        <select value={segment} onChange={e => setSegment(e.target.value)} style={input}>
          {['all', 'new', 'active', 'regular', 'lapsed', 'high_frequency', 'high_spend'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <button onClick={load} style={btnSecondary}>Search</button>
      </div>
      <div style={card}>
        {customers.length === 0 && <div style={{ fontSize: 12, color: '#888' }}>No customers in this segment yet.</div>}
        {customers.map(c => (
          <div key={c.id} onClick={() => openProfile(c.id)} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #f3f4f6', fontSize: 12, cursor: 'pointer' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{c.display_name || c.phone || c.email || 'Customer'}</div>
              <div style={{ color: '#888' }}>{c.order_count} orders · last {c.last_order_date ? new Date(c.last_order_date).toLocaleDateString('en-GB') : '—'} {c.loyalty_enrolled && '· 🏆 loyalty'}</div>
            </div>
            <div style={{ fontWeight: 700 }}>{money(c.recorded_spend, currency)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CustomerProfile({ customer, currency, onBack }: any) {
  return (
    <div>
      <button onClick={onBack} style={{ ...btnSecondary, marginBottom: 10 }}>← Back to list</button>
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{customer.display_name || customer.phone || customer.email || 'Customer'}</div>
        {(customer.phone || customer.email) && <div style={{ fontSize: 12, color: '#888' }}>{customer.phone} {customer.email}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginTop: 12 }}>
          <div><div style={label}>Orders</div><div style={kpiValue}>{customer.profile.order_count}</div></div>
          <div><div style={label}>Recorded spend</div><div style={kpiValue}>{money(customer.profile.recorded_spend, currency)}</div></div>
          <div><div style={label}>Avg order</div><div style={kpiValue}>{money(customer.profile.average_order_value, currency)}</div></div>
          <div><div style={label}>Loyalty balance</div><div style={kpiValue}>{customer.loyalty_balance}</div></div>
        </div>
        {customer.profile.favourite_items?.length > 0 && <div style={{ fontSize: 12, color: '#555', marginTop: 10 }}>Favourites: {customer.profile.favourite_items.map((i: any) => i.name).join(', ')}</div>}
        {customer.profile.preferred_van && <div style={{ fontSize: 12, color: '#555' }}>Usual van: {customer.profile.preferred_van.name}</div>}
      </div>
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Timeline</div>
        {customer.timeline.length === 0 && <div style={{ fontSize: 12, color: '#888' }}>Nothing yet.</div>}
        {customer.timeline.map((t: any, i: number) => (
          <div key={i} style={{ fontSize: 12, padding: '5px 0', borderTop: '1px solid #f3f4f6' }}>
            <strong>{t.type.replace(/_/g, ' ')}</strong> — {new Date(t.at).toLocaleDateString('en-GB')} {t.detail?.reason ? `(${t.detail.reason})` : ''}
          </div>
        ))}
      </div>
    </div>
  )
}

function LoyaltyTab() {
  const [settings, setSettings] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [lookupPhone, setLookupPhone] = useState('')
  const [lookupResult, setLookupResult] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => { fetch('/api/crm/loyalty').then(r => r.json()).then(setSettings) }, [])

  const save = async () => {
    setSaving(true)
    const res = await fetch('/api/crm/loyalty', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) })
    setSettings(await res.json())
    setSaving(false)
  }

  const lookup = async () => {
    setError('')
    const res = await fetch(`/api/crm/loyalty/account?phone=${encodeURIComponent(lookupPhone)}`)
    const data = await res.json()
    if (!res.ok) { setError(data.error); return }
    setLookupResult(data)
  }
  const redeem = async () => {
    const res = await fetch('/api/crm/loyalty/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ crm_customer_id: lookupResult.crm_customer_id }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error); return }
    lookup()
  }

  if (!settings) return <div style={{ fontSize: 13, color: '#888' }}>Loading…</div>

  return (
    <div>
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Programme settings</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8 }}>
          <input type="checkbox" checked={!!settings.enabled} onChange={e => setSettings({ ...settings, enabled: e.target.checked })} /> Loyalty enabled
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
          <input placeholder="Programme name" value={settings.programme_name} onChange={e => setSettings({ ...settings, programme_name: e.target.value })} style={input} />
          <select value={settings.earning_method} onChange={e => setSettings({ ...settings, earning_method: e.target.value })} style={input}>
            <option value="points_per_spend">Points per £ spent</option>
            <option value="visit_stamps">Visit stamps</option>
          </select>
          {settings.earning_method === 'points_per_spend' && <input type="number" step="0.1" placeholder="Points per £" value={settings.points_per_pound} onChange={e => setSettings({ ...settings, points_per_pound: Number(e.target.value) })} style={input} />}
          <input type="number" placeholder="Reward threshold" value={settings.reward_threshold} onChange={e => setSettings({ ...settings, reward_threshold: Number(e.target.value) })} style={input} />
          <input placeholder="Reward description" value={settings.reward_description} onChange={e => setSettings({ ...settings, reward_description: e.target.value })} style={input} />
          <input type="number" step="0.01" placeholder="Reward value" value={settings.reward_value} onChange={e => setSettings({ ...settings, reward_value: Number(e.target.value) })} style={input} />
        </div>
        <button onClick={save} disabled={saving} style={{ ...btn, marginTop: 10 }}>{saving ? 'Saving…' : 'Save'}</button>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Look up a customer (POS-style)</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="Phone number" value={lookupPhone} onChange={e => setLookupPhone(e.target.value)} style={input} />
          <button onClick={lookup} style={btnSecondary}>Look up</button>
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{error}</div>}
        {lookupResult?.found && (
          <div style={{ marginTop: 10, fontSize: 13 }}>
            Balance: <strong>{lookupResult.balance}</strong> / {lookupResult.reward_threshold} ({lookupResult.progress_pct}%)
            {lookupResult.reward_available && <button onClick={redeem} style={{ ...btn, marginLeft: 10, padding: '6px 12px', fontSize: 12 }}>Redeem: {lookupResult.reward_description}</button>}
          </div>
        )}
      </div>
    </div>
  )
}

function PromotionsTab({ vans, currency }: any) {
  const [promos, setPromos] = useState<any[]>([])
  const [vouchers, setVouchers] = useState<any[]>([])
  const [form, setForm] = useState<any>({ code: '', discount_type: 'fixed_amount', discount_value: '', min_spend: '0', per_customer_limit: '1' })
  const [error, setError] = useState('')

  const load = () => {
    fetch('/api/crm/promo-codes').then(r => r.json()).then(d => setPromos(Array.isArray(d) ? d : []))
    fetch('/api/crm/vouchers').then(r => r.json()).then(d => setVouchers(Array.isArray(d) ? d : []))
  }
  useEffect(() => { load() }, [])

  const createPromo = async () => {
    setError('')
    const res = await fetch('/api/crm/promo-codes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, discount_value: Number(form.discount_value), min_spend: Number(form.min_spend), per_customer_limit: Number(form.per_customer_limit) }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error); return }
    setForm({ code: '', discount_type: 'fixed_amount', discount_value: '', min_spend: '0', per_customer_limit: '1' })
    load()
  }
  const toggle = async (id: string, is_active: boolean) => {
    await fetch(`/api/crm/promo-codes/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !is_active }) })
    load()
  }

  return (
    <div>
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>New promo code</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
          <input placeholder="CODE" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} style={input} />
          <select value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })} style={input}>
            <option value="fixed_amount">Fixed amount</option>
            <option value="percentage">Percentage</option>
          </select>
          <input type="number" step="0.01" placeholder="Value" value={form.discount_value} onChange={e => setForm({ ...form, discount_value: e.target.value })} style={input} />
          <input type="number" step="0.01" placeholder="Min spend" value={form.min_spend} onChange={e => setForm({ ...form, min_spend: e.target.value })} style={input} />
          <input type="number" placeholder="Per-customer limit" value={form.per_customer_limit} onChange={e => setForm({ ...form, per_customer_limit: e.target.value })} style={input} />
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{error}</div>}
        <button onClick={createPromo} disabled={!form.code || !form.discount_value} style={{ ...btn, marginTop: 10 }}>Create</button>
      </div>
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Promo codes</div>
        {promos.map(p => (
          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #f3f4f6', fontSize: 12 }}>
            <div>{p.code} · {p.discount_type === 'percentage' ? `${p.discount_value}%` : money(p.discount_value, currency)} · {p.redemption_count} used</div>
            <button onClick={() => toggle(p.id, p.is_active)} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 11, color: p.is_active ? '#059669' : '#888' }}>{p.is_active ? 'Active' : 'Inactive'}</button>
          </div>
        ))}
      </div>
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Vouchers issued</div>
        {vouchers.slice(0, 20).map(v => (
          <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #f3f4f6', fontSize: 12 }}>
            <div>{v.code} · {v.source} {v.crm_customers?.display_name ? `· ${v.crm_customers.display_name}` : ''}</div>
            <span style={{ color: v.status === 'ACTIVE' ? '#059669' : '#888' }}>{v.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CampaignsTab() {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [form, setForm] = useState<any>({ name: '', channel: 'email', segment: 'all', subject: '', message: '' })
  const [error, setError] = useState('')

  const load = () => fetch('/api/crm/campaigns').then(r => r.json()).then(d => setCampaigns(Array.isArray(d) ? d : []))
  useEffect(() => { load() }, [])

  const create = async () => {
    setError('')
    const res = await fetch('/api/crm/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: form.name, channel: form.channel, subject: form.subject, message: form.message, segment_definition: { type: form.segment } }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error); return }
    setForm({ name: '', channel: 'email', segment: 'all', subject: '', message: '' })
    load()
  }
  const confirm = async (id: string) => { await fetch(`/api/crm/campaigns/${id}/confirm`, { method: 'POST' }); load() }
  const cancel = async (id: string) => { await fetch(`/api/crm/campaigns/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CANCELLED' }) }); load() }

  return (
    <div>
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>New campaign</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8 }}>
          <input placeholder="Campaign name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={input} />
          <select value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })} style={input}>
            <option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option>
          </select>
          <select value={form.segment} onChange={e => setForm({ ...form, segment: e.target.value })} style={input}>
            {['all', 'new', 'active', 'regular', 'lapsed', 'high_frequency', 'high_spend'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          {form.channel === 'email' && <input placeholder="Subject" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} style={input} />}
        </div>
        <textarea placeholder="Message" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} style={{ ...input, width: '100%', marginTop: 8, minHeight: 70, boxSizing: 'border-box' }} />
        {error && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{error}</div>}
        <button onClick={create} disabled={!form.name || !form.message} style={{ ...btn, marginTop: 10 }}>Save as draft</button>
      </div>
      <div style={card}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Campaigns</div>
        {campaigns.map(c => (
          <div key={c.id} style={{ padding: '8px 0', borderTop: '1px solid #f3f4f6', fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{c.name}</strong><span>{c.status}</span>
            </div>
            <div style={{ color: '#888' }}>{c.channel} · ~{c.estimated_recipients} recipients · sent {c.delivery_stats?.SENT ?? 0}, failed {c.delivery_stats?.FAILED ?? 0}</div>
            {['DRAFT', 'SCHEDULED'].includes(c.status) && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={() => confirm(c.id)} style={{ ...btn, padding: '5px 10px', fontSize: 11 }}>Confirm & send</button>
                <button onClick={() => cancel(c.id)} style={{ ...btnSecondary, padding: '5px 10px', fontSize: 11 }}>Cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ReviewsTab({ vans }: any) {
  const [data, setData] = useState<any>(null)
  useEffect(() => { fetch('/api/crm/reviews').then(r => r.json()).then(setData) }, [])
  const publish = async (id: string, is_published: boolean) => {
    await fetch(`/api/crm/reviews/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_published }) })
    fetch('/api/crm/reviews').then(r => r.json()).then(setData)
  }
  if (!data) return <div style={{ fontSize: 13, color: '#888' }}>Loading…</div>
  return (
    <div>
      <div style={card}>
        <div style={{ display: 'flex', gap: 24 }}>
          <div><div style={label}>Average rating</div><div style={kpiValue}>{data.summary.average_rating ?? '—'}</div></div>
          <div><div style={label}>Reviews</div><div style={kpiValue}>{data.summary.review_count}</div></div>
          <div><div style={label}>Published</div><div style={kpiValue}>{data.summary.published_count}</div></div>
        </div>
      </div>
      <div style={card}>
        {data.reviews.map((r: any) => (
          <div key={r.id} style={{ padding: '8px 0', borderTop: '1px solid #f3f4f6', fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)} — {r.guest_name ?? 'Customer'}</div>
              <button onClick={() => publish(r.id, !r.is_published)} style={{ ...btnSecondary, padding: '4px 10px', fontSize: 11 }}>{r.is_published ? 'Unpublish' : 'Publish'}</button>
            </div>
            {r.comment && <div style={{ color: '#555', marginTop: 4 }}>{r.comment}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
