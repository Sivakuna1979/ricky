'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

export function RegenerateButton({ kind, id }: { kind: 'topics' | 'scripts' | 'videos'; id: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    await fetch(`/api/${kind}/${id}/regenerate`, { method: 'POST' })
    setLoading(false)
    router.refresh()
  }

  return (
    <button onClick={run} disabled={loading} className="btn-outline">
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Regenerate
    </button>
  )
}
