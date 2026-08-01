'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, MessageSquareWarning } from 'lucide-react'

export function ApprovalActions({ approvalId }: { approvalId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  async function decide(status: 'approved' | 'rejected' | 'changes_requested') {
    setLoading(status)
    const notes = status === 'changes_requested' ? prompt('What should change?') ?? '' : undefined
    await fetch(`/api/approvals/${approvalId}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes }),
    })
    setLoading(null)
    router.refresh()
  }

  return (
    <div className="flex gap-2">
      <button onClick={() => decide('approved')} disabled={!!loading} className="btn-primary !bg-green-600 hover:!bg-green-700">
        <Check className="h-4 w-4" /> Approve
      </button>
      <button onClick={() => decide('changes_requested')} disabled={!!loading} className="btn-outline">
        <MessageSquareWarning className="h-4 w-4" /> Request changes
      </button>
      <button onClick={() => decide('rejected')} disabled={!!loading} className="btn-danger">
        <X className="h-4 w-4" /> Reject
      </button>
    </div>
  )
}
