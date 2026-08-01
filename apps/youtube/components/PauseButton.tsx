'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pause, Play } from 'lucide-react'

export function PauseButton({ isPaused }: { isPaused: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (!isPaused && !confirm('This immediately stops ALL future generation and uploads across every channel. Continue?')) return
    setLoading(true)
    await fetch('/api/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused: !isPaused, reason: 'Manual emergency pause from dashboard' }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={isPaused ? 'btn-primary' : 'btn-danger'}
      title={isPaused ? 'Resume automation' : 'Emergency pause — stops all future generation and uploads'}
    >
      {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      {isPaused ? 'Resume automation' : 'Emergency pause'}
    </button>
  )
}
