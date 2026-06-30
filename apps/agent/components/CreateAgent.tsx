'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

export default function CreateAgent({ atLimit }: { atLimit: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, system_prompt: prompt }),
    })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      return setError(d.error ?? 'Failed to create agent')
    }
    setName('')
    setPrompt('')
    setOpen(false)
    router.refresh()
  }

  if (atLimit) {
    return (
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
        You’ve reached your agent limit. Upgrade your plan to add more agents.
      </p>
    )
  }

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" /> New agent
      </button>
    )
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">New agent</h2>
      <input className="input" placeholder="Agent name" value={name} onChange={(e) => setName(e.target.value)} />
      <textarea
        className="input min-h-[100px]"
        placeholder="System prompt — persona & instructions"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" onClick={create} disabled={busy || !name}>
          {busy ? 'Creating…' : 'Create agent'}
        </button>
        <button className="btn-outline" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
