// @ts-nocheck
'use client'
// M12-M70 — the Group Dashboard. Every number shown comes straight from
// /api/groups/[groupId]/* routes, which themselves reuse
// lib/groups/dashboard.ts's aggregation of Phase B/H/K's own existing
// functions — the dashboard and the Group AI tab can never disagree,
// exactly like the business Finance Dashboard's own convention.
import { useEffect, useState } from 'react'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'businesses', label: 'Businesses' },
  { key: 'templates', label: 'Menu Templates' },
  { key: 'purchasing', label: 'Suppliers & Purchasing' },
  { key: 'documents', label: 'Documents' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'transfers', label: 'Stock Transfers' },
  { key: 'staff', label: 'Staff & Regions' },
  { key: 'ai', label: 'Group AI' },
]

const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, marginBottom: 14 }
const label = { fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase' as const, letterSpacing: 0.4, marginBottom: 4 }
const kpiValue = { fontSize: 22, fontWeight: 800, color: '#111' }
const input = { padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }
const btn = { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }
const btnSecondary = { ...btn, background: '#f5f6fa', color: '#374151', border: '1px solid #e5e7eb' }
const money = (n: any) => `£${Number(n ?? 0).toFixed(2)}`

export function GroupDashboard({ groups, activeGroupId }: { groups: { id: string; name: string }[]; activeGroupId: string }) {
  const [groupId, setGroupId] = useState(activeGroupId)
  const [tab, setTab] = useState('overview')

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>🏢 Group Dashboard</div>
        {groups.length > 1 && (
          <select value={groupId} onChange={e => { setGroupId(e.target.value); window.history.replaceState(null, '', `/group/dashboard?group_id=${e.target.value}`) }} style={input}>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}
        <a href="/group/new" style={{ ...btnSecondary, textDecoration: 'none', marginLeft: 'auto' }}>+ New group</a>
        <a href="/dashboard" style={{ ...btnSecondary, textDecoration: 'none' }}>← My business</a>
      </div>

      <div style={{ padding: '16px 20px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', background: tab === t.key ? '#fff7ed' : '#fff', color: tab === t.key ? '#f97316' : '#555', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: '0 20px 40px', maxWidth: 1000 }}>
        {tab === 'overview' && <OverviewTab groupId={groupId} />}
        {tab === 'businesses' && <BusinessesTab groupId={groupId} />}
        {tab === 'templates' && <TemplatesTab groupId={groupId} />}
        {tab === 'purchasing' && <PurchasingTab groupId={groupId} />}
        {tab === 'documents' && <DocumentsTab groupId={groupId} />}
        {tab === 'announcements' && <AnnouncementsTab groupId={groupId} />}
        {tab === 'transfers' && <TransfersTab groupId={groupId} />}
        {tab === 'staff' && <StaffTab groupId={groupId} />}
        {tab === 'ai' && <GroupAiTab groupId={groupId} />}
      </div>
    </div>
  )
}

function OverviewTab({ groupId }: { groupId: string }) {
  const [data, setData] = useState<any>(null)
  const [group, setGroup] = useState<any>(null)
  const [brandForm, setBrandForm] = useState<any>({ name: '', primary_color: '#f97316' })
  const [savingBrand, setSavingBrand] = useState(false)

  useEffect(() => { fetch(`/api/groups/${groupId}/dashboard`).then(r => r.json()).then(setData).catch(() => {}) }, [groupId])
  useEffect(() => {
    fetch(`/api/groups/${groupId}`).then(r => r.json()).then(g => { setGroup(g); setBrandForm({ name: g.name, primary_color: g.branding?.primary_color ?? '#f97316' }) }).catch(() => {})
  }, [groupId])

  const saveBrand = async () => {
    setSavingBrand(true)
    await fetch(`/api/groups/${groupId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: brandForm.name, branding: { primary_color: brandForm.primary_color } }) })
    setSavingBrand(false)
  }

  if (!data) return <div style={{ color: '#6b7280' }}>Loading…</div>

  return (
    <div>
      <div style={card}>
        <div style={label}>Your role</div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{data.group?.my_role} {data.group?.region_id ? '(region-scoped)' : ''}</div>
      </div>

      {group && ['GROUP_OWNER', 'GROUP_ADMIN'].includes(data.group?.my_role) && (
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Brand</div>
          <input value={brandForm.name} onChange={e => setBrandForm({ ...brandForm, name: e.target.value })} style={{ ...input, marginRight: 6 }} />
          <input type="color" value={brandForm.primary_color} onChange={e => setBrandForm({ ...brandForm, primary_color: e.target.value })} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          <button onClick={saveBrand} disabled={savingBrand} style={btnSecondary}>Save</button>
        </div>
      )}

      {data.kpis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10, marginBottom: 14 }}>
          <div style={card}><div style={label}>Businesses</div><div style={kpiValue}>{data.business_count}</div></div>
          <div style={card}><div style={label}>Today's revenue</div><div style={kpiValue}>{money(data.kpis.totals.revenue)}</div></div>
          <div style={card}><div style={label}>Today's orders</div><div style={kpiValue}>{data.kpis.totals.orders}</div></div>
        </div>
      )}

      {data.attention && (
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>🔔 Needs attention ({data.attention.length})</div>
          {data.attention.length === 0 ? <div style={{ color: '#6b7280', fontSize: 13 }}>Nothing outstanding across the group.</div> : data.attention.slice(0, 20).map((e: any) => (
            <div key={`${e.business_id}-${e.dedupeKey}`} style={{ padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
              <b>[{e.priority}]</b> {e.business_name}: {e.title}
            </div>
          ))}
        </div>
      )}

      {data.stock && (
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>📦 Stock</div>
          <div style={{ fontSize: 13 }}>{data.stock.low_stock} low · {data.stock.out_of_stock} out of stock across the group</div>
        </div>
      )}
      {data.hygiene && (
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>🧼 Hygiene</div>
          <div style={{ fontSize: 13 }}>{data.hygiene.missed_checks_7d} van(s) missing a check in the last 7 days</div>
        </div>
      )}
      {data.vehicles && (
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>🚐 Vehicles</div>
          <div style={{ fontSize: 13 }}>{data.vehicles.overdue} overdue · {data.vehicles.expiring_soon} expiring within 30 days</div>
        </div>
      )}
      {data.customers && (
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>👥 Customer growth</div>
          <div style={{ fontSize: 13 }}>{data.customers.new_customers_30d} new customers across the group in the last 30 days</div>
        </div>
      )}
    </div>
  )
}

function BusinessesTab({ groupId }: { groupId: string }) {
  const [directory, setDirectory] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<any[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    fetch(`/api/groups/${groupId}/dashboard`).then(r => r.json()).then(d => setDirectory(d.directory ?? []))
    fetch(`/api/groups/${groupId}/members`).then(r => r.json()).then(d => setMembers(Array.isArray(d) ? d : []))
  }
  useEffect(load, [groupId])

  const search = async (q: string) => {
    setQuery(q)
    if (q.trim().length < 2) { setCandidates([]); return }
    const res = await fetch(`/api/groups/${groupId}/businesses?q=${encodeURIComponent(q)}`)
    setCandidates(await res.json().catch(() => []))
  }
  const invite = async (business_id: string) => {
    setBusy(business_id)
    await fetch(`/api/groups/${groupId}/members`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ business_id }) })
    setBusy(null); setCandidates([]); setQuery(''); load()
  }
  const remove = async (businessId: string) => {
    setBusy(businessId)
    await fetch(`/api/groups/${groupId}/members/${businessId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'remove' }) })
    setBusy(null); load()
  }

  return (
    <div>
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Invite an existing business</div>
        <input value={query} onChange={e => search(e.target.value)} placeholder="Search by business name…" style={{ ...input, width: 280 }} />
        {candidates.map((c: any) => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
            <span>{c.name} — {c.city}</span>
            <button onClick={() => invite(c.id)} disabled={busy === c.id} style={btn}>Invite</button>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Members ({directory.length})</div>
        {directory.map((b: any) => (
          <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
            <span>{b.name} {b.region ? `· ${b.region}` : ''} — {b.active_van_count}/{b.van_count} vans active</span>
          </div>
        ))}
      </div>

      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>All memberships (incl. pending/removed)</div>
        {members.map((m: any) => (
          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
            <span>{m.businesses?.name} — <b>{m.status}</b></span>
            {['INVITED', 'ACTIVE'].includes(m.status) && <button onClick={() => remove(m.business_id)} disabled={busy === m.business_id} style={btnSecondary}>Remove</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

function TemplatesTab({ groupId }: { groupId: string }) {
  const [templates, setTemplates] = useState<any[]>([])
  const [newName, setNewName] = useState('')
  const [policy, setPolicy] = useState('GROUP_DEFAULT_BUSINESS_CAN_OVERRIDE')
  const [selected, setSelected] = useState<any>(null)
  const [itemForm, setItemForm] = useState<any>({ category: '', name: '', recommended_price: '', price_policy: 'BUSINESS_CONTROLLED' })

  const load = () => fetch(`/api/groups/${groupId}/templates`).then(r => r.json()).then(d => setTemplates(Array.isArray(d) ? d : []))
  useEffect(load, [groupId])

  const openTemplate = async (id: string) => { const res = await fetch(`/api/groups/${groupId}/templates/${id}`); setSelected(await res.json()) }
  const create = async () => {
    if (!newName.trim()) return
    await fetch(`/api/groups/${groupId}/templates`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName, policy }) })
    setNewName(''); load()
  }
  const addItem = async () => {
    if (!selected || !itemForm.category || !itemForm.name) return
    await fetch(`/api/groups/${groupId}/templates/${selected.id}/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...itemForm, recommended_price: itemForm.recommended_price ? Number(itemForm.recommended_price) : null }) })
    setItemForm({ category: '', name: '', recommended_price: '', price_policy: 'BUSINESS_CONTROLLED' })
    openTemplate(selected.id)
  }
  const publish = async () => {
    if (!selected) return
    const res = await fetch(`/api/groups/${groupId}/templates/${selected.id}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const data = await res.json().catch(() => ({}))
    alert(res.ok ? `Published — proposed to ${data.proposed_to} business(es).` : (data.error ?? 'Could not publish'))
    openTemplate(selected.id)
  }

  return (
    <div>
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>New template</div>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Template name" style={{ ...input, marginRight: 8 }} />
        <select value={policy} onChange={e => setPolicy(e.target.value)} style={{ ...input, marginRight: 8 }}>
          <option value="GROUP_LOCKED">Group locked</option>
          <option value="GROUP_DEFAULT_BUSINESS_CAN_OVERRIDE">Group default, business can override</option>
          <option value="BUSINESS_CONTROLLED">Business controlled</option>
        </select>
        <button onClick={create} style={btn}>Create</button>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Templates</div>
        {templates.map((t: any) => (
          <div key={t.id} onClick={() => openTemplate(t.id)} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13, cursor: 'pointer', color: selected?.id === t.id ? '#f97316' : '#111', fontWeight: selected?.id === t.id ? 800 : 400 }}>
            {t.name} — {t.status} ({t.policy})
          </div>
        ))}
      </div>

      {selected && (
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>{selected.name} — items</div>
          {(selected.items ?? []).map((i: any) => (
            <div key={i.id} style={{ padding: '4px 0', fontSize: 13, color: '#374151' }}>{i.category} · {i.name} {i.recommended_price ? `— £${Number(i.recommended_price).toFixed(2)}` : ''} ({i.price_policy})</div>
          ))}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            <input placeholder="Category" value={itemForm.category} onChange={e => setItemForm({ ...itemForm, category: e.target.value })} style={{ ...input, width: 100 }} />
            <input placeholder="Item name" value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} style={{ ...input, width: 140 }} />
            <input placeholder="Recommended £" value={itemForm.recommended_price} onChange={e => setItemForm({ ...itemForm, recommended_price: e.target.value })} style={{ ...input, width: 100 }} />
            <select value={itemForm.price_policy} onChange={e => setItemForm({ ...itemForm, price_policy: e.target.value })} style={input}>
              <option value="REQUIRED">Required</option>
              <option value="RECOMMENDED">Recommended</option>
              <option value="BUSINESS_CONTROLLED">Business controlled</option>
            </select>
            <button onClick={addItem} style={btnSecondary}>Add item</button>
          </div>
          <button onClick={publish} style={{ ...btn, marginTop: 14 }}>📣 Publish & propose to all active members</button>
          {(selected.versions ?? []).length > 0 && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>Published versions: {selected.versions.map((v: any) => `v${v.version_number}`).join(', ')}</div>}
        </div>
      )}
    </div>
  )
}

function PurchasingTab({ groupId }: { groupId: string }) {
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [proposals, setProposals] = useState<any[]>([])
  const [supplierForm, setSupplierForm] = useState<any>({ name: '', category: '' })
  const [proposalTitle, setProposalTitle] = useState('')

  const load = () => {
    fetch(`/api/groups/${groupId}/suppliers`).then(r => r.json()).then(d => setSuppliers(Array.isArray(d) ? d : []))
    fetch(`/api/groups/${groupId}/purchases`).then(r => r.json()).then(d => setProposals(Array.isArray(d) ? d : []))
  }
  useEffect(load, [groupId])

  const addSupplier = async () => {
    if (!supplierForm.name.trim()) return
    await fetch(`/api/groups/${groupId}/suppliers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(supplierForm) })
    setSupplierForm({ name: '', category: '' }); load()
  }
  const addProposal = async () => {
    if (!proposalTitle.trim()) return
    await fetch(`/api/groups/${groupId}/purchases`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: proposalTitle }) })
    setProposalTitle(''); load()
  }

  return (
    <div>
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Preferred supplier directory</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>Names and categories only — account numbers, pricing and contact details stay private to each business.</div>
        {suppliers.map((s: any) => <div key={s.id} style={{ padding: '4px 0', fontSize: 13 }}>{s.name} {s.category ? `— ${s.category}` : ''}</div>)}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input placeholder="Supplier name" value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} style={input} />
          <input placeholder="Category" value={supplierForm.category} onChange={e => setSupplierForm({ ...supplierForm, category: e.target.value })} style={input} />
          <button onClick={addSupplier} style={btnSecondary}>Add</button>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Group purchasing proposals</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>A shared draft only — never places a real order. Each business converts its own line into its own purchase order.</div>
        {proposals.map((p: any) => (
          <div key={p.id} style={{ padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
            <b>{p.title}</b> — {(p.group_purchase_proposal_items ?? []).length} line(s)
          </div>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input placeholder="Proposal title" value={proposalTitle} onChange={e => setProposalTitle(e.target.value)} style={input} />
          <button onClick={addProposal} style={btnSecondary}>Create proposal</button>
        </div>
      </div>
    </div>
  )
}

function DocumentsTab({ groupId }: { groupId: string }) {
  const [docs, setDocs] = useState<any[]>([])
  const [form, setForm] = useState<any>({ title: '', category: 'MANUAL', url: '' })
  const load = () => fetch(`/api/groups/${groupId}/documents`).then(r => r.json()).then(d => setDocs(Array.isArray(d) ? d : []))
  useEffect(load, [groupId])
  const create = async () => {
    if (!form.title.trim() || !form.url.trim()) return
    await fetch(`/api/groups/${groupId}/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setForm({ title: '', category: 'MANUAL', url: '' }); load()
  }
  return (
    <div>
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Add a group document</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>Link to an existing document (PDF, Google Doc, etc.) — viewing/acknowledgement is tracked, never treated as compliance certification.</div>
        <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{ ...input, marginRight: 6 }} />
        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...input, marginRight: 6 }}>
          {['MANUAL', 'SOP', 'TRAINING', 'SUPPLIER_LIST', 'MENU_STANDARD', 'OTHER'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input placeholder="https://…" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} style={{ ...input, marginRight: 6, width: 220 }} />
        <button onClick={create} style={btnSecondary}>Add</button>
      </div>
      <div style={card}>
        {docs.map((d: any) => <div key={d.id} style={{ padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}><b>{d.category}</b> — <a href={d.url} target="_blank" rel="noopener noreferrer">{d.title}</a></div>)}
      </div>
    </div>
  )
}

function AnnouncementsTab({ groupId }: { groupId: string }) {
  const [list, setList] = useState<any[]>([])
  const [form, setForm] = useState<any>({ title: '', body: '' })
  const load = () => fetch(`/api/groups/${groupId}/announcements`).then(r => r.json()).then(d => setList(Array.isArray(d) ? d : []))
  useEffect(load, [groupId])
  const create = async () => {
    if (!form.title.trim() || !form.body.trim()) return
    await fetch(`/api/groups/${groupId}/announcements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    setForm({ title: '', body: '' }); load()
  }
  const send = async (id: string) => {
    const res = await fetch(`/api/groups/${groupId}/announcements/${id}/send`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    alert(res.ok ? `Sent to ${data.recipient_count} people across ${data.business_count} businesses.` : (data.error ?? 'Could not send'))
    load()
  }
  return (
    <div>
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>New announcement</div>
        <input placeholder="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{ ...input, width: '100%', marginBottom: 6, boxSizing: 'border-box' }} />
        <textarea placeholder="Message" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} style={{ ...input, width: '100%', minHeight: 70, marginBottom: 8, boxSizing: 'border-box' }} />
        <button onClick={create} style={btnSecondary}>Save draft</button>
      </div>
      <div style={card}>
        {list.map((a: any) => (
          <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
            <div><b>{a.title}</b> {a.sent_at ? '— sent' : '— draft'}</div>
            <div style={{ color: '#6b7280', marginBottom: 4 }}>{a.body}</div>
            {!a.sent_at && <button onClick={() => send(a.id)} style={btn}>Send now</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

function TransfersTab({ groupId }: { groupId: string }) {
  const [transfers, setTransfers] = useState<any[]>([])
  const load = () => fetch(`/api/groups/${groupId}/transfers`).then(r => r.json()).then(d => setTransfers(Array.isArray(d) ? d : []))
  useEffect(load, [groupId])
  return (
    <div style={card}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Inter-business stock transfers</div>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>Proposed from each business's own Stock page. Accepting one moves real stock on both sides via the existing stock-movement system.</div>
      {transfers.length === 0 ? <div style={{ color: '#6b7280', fontSize: 13 }}>No transfers yet.</div> : transfers.map((t: any) => (
        <div key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
          {t.from_business?.name} → {t.to_business?.name}: {t.quantity} {t.from_item?.unit ?? ''} of {t.from_item?.name} — <b>{t.status}</b>
        </div>
      ))}
    </div>
  )
}

function StaffTab({ groupId }: { groupId: string }) {
  const [staff, setStaff] = useState<any[]>([])
  const [regions, setRegions] = useState<any[]>([])
  const [inviteForm, setInviteForm] = useState<any>({ email: '', role: 'GROUP_VIEWER' })
  const [regionName, setRegionName] = useState('')

  const load = () => {
    fetch(`/api/groups/${groupId}/staff`).then(r => r.json()).then(d => setStaff(Array.isArray(d) ? d : []))
    fetch(`/api/groups/${groupId}/regions`).then(r => r.json()).then(d => setRegions(Array.isArray(d) ? d : []))
  }
  useEffect(load, [groupId])

  const invite = async () => {
    if (!inviteForm.email.trim()) return
    const res = await fetch(`/api/groups/${groupId}/staff`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inviteForm) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) alert(data.error)
    setInviteForm({ email: '', role: 'GROUP_VIEWER' }); load()
  }
  const addRegion = async () => {
    if (!regionName.trim()) return
    await fetch(`/api/groups/${groupId}/regions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: regionName }) })
    setRegionName(''); load()
  }

  return (
    <div>
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Add group staff</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>They must already have a FoodTaxi account.</div>
        <input placeholder="Email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} style={{ ...input, marginRight: 6 }} />
        <select value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })} style={{ ...input, marginRight: 6 }}>
          {['GROUP_ADMIN', 'REGIONAL_MANAGER', 'GROUP_FINANCE', 'GROUP_OPERATIONS', 'GROUP_MARKETING', 'GROUP_VIEWER'].map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button onClick={invite} style={btnSecondary}>Add</button>
      </div>
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Staff</div>
        {staff.map((s: any) => <div key={s.id} style={{ padding: '4px 0', fontSize: 13 }}>{s.users?.full_name ?? s.users?.email} — {s.role}{s.is_active ? '' : ' (inactive)'}</div>)}
      </div>
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Regions</div>
        {regions.map((r: any) => <div key={r.id} style={{ padding: '4px 0', fontSize: 13 }}>{r.name}</div>)}
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input placeholder="Region name" value={regionName} onChange={e => setRegionName(e.target.value)} style={input} />
          <button onClick={addRegion} style={btnSecondary}>Add region</button>
        </div>
      </div>
    </div>
  )
}

function GroupAiTab({ groupId }: { groupId: string }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input_, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const send = async () => {
    if (!input_.trim()) return
    const nextHistory = [...messages, { role: 'user', content: input_ }]
    setMessages(nextHistory); setInput(''); setSending(true)
    const res = await fetch(`/api/groups/${groupId}/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: input_, history: messages }) })
    const data = await res.json().catch(() => ({}))
    setMessages([...nextHistory, { role: 'assistant', content: data.text ?? data.error ?? 'Something went wrong.' }])
    setSending(false)
  }

  return (
    <div style={card}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>🤖 Group AI — read-only, scoped to your authorised businesses</div>
      <div style={{ minHeight: 200, maxHeight: 400, overflowY: 'auto', marginBottom: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 8, textAlign: m.role === 'user' ? 'right' : 'left' }}>
            <span style={{ display: 'inline-block', padding: '8px 12px', borderRadius: 10, background: m.role === 'user' ? '#fff7ed' : '#f5f6fa', fontSize: 13, maxWidth: '80%' }}>{m.content}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={input_} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Ask about the group…" style={{ ...input, flex: 1 }} />
        <button onClick={send} disabled={sending} style={btn}>{sending ? '…' : 'Send'}</button>
      </div>
    </div>
  )
}
