'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import type { KnowledgeDocument } from '@/lib/types'

export default function KnowledgeManager({ docs }: { docs: KnowledgeDocument[] }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!title || !content) return
    setBusy(true)
    await fetch('/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, source: 'manual' }),
    })
    setBusy(false)
    setTitle('')
    setContent('')
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Delete this document?')) return
    await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-3">
        <h2 className="font-semibold">Add a document</h2>
        <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea
          className="input min-h-[140px]"
          placeholder="Paste FAQ, policy, product info…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <button className="btn-primary" onClick={add} disabled={busy || !title || !content}>
          {busy ? 'Adding…' : 'Add to knowledge base'}
        </button>
      </div>

      <div className="space-y-2">
        {docs.map((d) => (
          <div key={d.id} className="card flex items-start justify-between">
            <div>
              <div className="font-medium">{d.title}</div>
              <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{d.content}</p>
            </div>
            <button onClick={() => remove(d.id)} className="btn-outline">
              <Trash2 className="h-4 w-4 text-red-600" />
            </button>
          </div>
        ))}
        {!docs.length && <p className="text-sm text-neutral-500">No documents yet.</p>}
      </div>
    </div>
  )
}
