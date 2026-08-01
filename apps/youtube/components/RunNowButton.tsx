'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlayCircle } from 'lucide-react'

export function RunNowButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setMessage(null)
    const res = await fetch('/api/run-now', { method: 'POST' })
    const data = await res.json()
    setLoading(false)
    setMessage(res.ok ? `Queued ${data.enqueued} production run(s).` : data.error ?? 'Failed to start.')
    router.refresh()
  }

  return (
    <div className="flex items-center gap-2">
      {message && <span className="text-xs text-neutral-500">{message}</span>}
      <button onClick={run} disabled={loading} className="btn-outline">
        <PlayCircle className="h-4 w-4" />
        {loading ? 'Starting…' : "Run today's production now"}
      </button>
    </div>
  )
}
