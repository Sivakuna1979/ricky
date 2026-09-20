// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'

const CARD = { background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', marginBottom: 20 }
const INPUT = { padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, width: '100%', boxSizing: 'border-box' as const }
const BTN = { padding: '10px 18px', borderRadius: 8, background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }
const CATEGORIES = ['general', 'route_note', 'supplier_note', 'event_note']

export function BusinessMemory() {
  const [notes, setNotes] = useState<any[]>([])
  const [semantic, setSemantic] = useState(false)
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<any>({ title: '', content: '', category: 'general' })
  const [error, setError] = useState('')

  const load = (q?: string) => {
    fetch(`/api/memory${q ? `?q=${encodeURIComponent(q)}` : ''}`).then(r => r.json()).then(d => { setNotes(d.notes ?? []); setSemantic(!!d.semantic) })
  }
  useEffect(() => load(), [])

  const search = () => load(query.trim() || undefined)

  const submit = async () => {
    if (!form.content.trim()) return setError('Note content is required')
    setError('')
    const res = await fetch('/api/memory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await res.json()
    if (!res.ok) return setError(d.error ?? 'Failed to save note')
    setShowAdd(false); setForm({ title: '', content: '', category: 'general' }); load()
  }

  const remove = async (id: string) => {
    await fetch(`/api/memory/${id}`, { method: 'DELETE' })
    load(query || undefined)
  }

  return (
    <div>
      <div style={CARD}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 8 }}>About Business Memory</div>
        <p style={{ fontSize: 13, color: '#666', margin: 0, lineHeight: 1.6 }}>
          Save notes about your business — road closures, supplier issues, why a day was unusual. FoodTaxi AI can search these by meaning to help explain what it finds in your data, but notes are context, never treated as facts or numbers themselves.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input style={INPUT} placeholder="Search notes…" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
        <button style={{ ...BTN, background: '#f5f6fa', color: '#374151', border: '1px solid #e5e7eb' }} onClick={search}>Search</button>
        <button style={BTN} onClick={() => setShowAdd(v => !v)}>{showAdd ? 'Cancel' : '+ Add note'}</button>
      </div>

      {query && <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>{semantic ? 'Showing notes closest in meaning to your search.' : 'Semantic search is not configured — showing recent notes instead.'}</div>}

      {showAdd && (
        <div style={CARD}>
          <input style={{ ...INPUT, marginBottom: 10 }} placeholder="Title (optional)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <select style={{ ...INPUT, marginBottom: 10 }} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
          </select>
          <textarea style={{ ...INPUT, marginBottom: 10, minHeight: 90, fontFamily: 'inherit' }} placeholder="What happened?" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
          {error && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          <button style={BTN} onClick={submit}>Save note</button>
        </div>
      )}

      {notes.length === 0 ? <div style={{ ...CARD, textAlign: 'center', color: '#888' }}>No notes yet.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.map((n: any) => (
            <div key={n.id} style={{ ...CARD, margin: 0, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{n.title || n.category?.replace('_', ' ')}</div>
                  <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>{n.content}</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>{n.category?.replace('_', ' ')} · {new Date(n.created_at).toLocaleDateString('en-GB')}{n.users?.full_name ? ` · ${n.users.full_name}` : ''}{n.relevance !== undefined ? ` · relevance ${n.relevance}` : ''}</div>
                </div>
                {n.id && <button onClick={() => remove(n.id)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>Delete</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
