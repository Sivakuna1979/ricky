// @ts-nocheck
'use client'
// M76 — group onboarding step 1: create the group entity. Any
// authenticated FoodTaxi user may create one (creating a GROUP has no
// subscription/billing implication — M46).
import { useState } from 'react'

export default function NewGroupPage() {
  const [name, setName] = useState('')
  const [type, setType] = useState('BUSINESS_GROUP')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  const create = async () => {
    if (!name.trim()) return
    setCreating(true); setError('')
    const res = await fetch('/api/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, type }) })
    const data = await res.json().catch(() => ({}))
    setCreating(false)
    if (!res.ok) { setError(data.error ?? 'Could not create the group'); return }
    window.location.href = `/group/dashboard?group_id=${data.id}`
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 32, width: 420, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontSize: 20, marginBottom: 6 }}>Create a Group</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>An optional layer above your businesses — a franchise, a multi-site group, or a regional brand. Existing businesses join by explicit invitation and can always leave.</p>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>Name</div>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Northern Fish Co." style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 14, boxSizing: 'border-box' }} />
        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 4 }}>Type</div>
        <select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 20 }}>
          <option value="FRANCHISE">Franchise</option>
          <option value="BUSINESS_GROUP">Business group</option>
          <option value="REGIONAL_GROUP">Regional group</option>
          <option value="OTHER">Other</option>
        </select>
        {error && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 10 }}>{error}</div>}
        <button onClick={create} disabled={creating || !name.trim()} style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#f97316', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: creating || !name.trim() ? 0.6 : 1 }}>
          {creating ? 'Creating…' : 'Create group'}
        </button>
      </div>
    </div>
  )
}
