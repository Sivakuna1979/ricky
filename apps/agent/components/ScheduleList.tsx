'use client'

import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import type { ScheduledJob } from '@/lib/types'

export default function ScheduleList({ jobs }: { jobs: ScheduledJob[] }) {
  const router = useRouter()

  async function cancel(id: string) {
    await fetch(`/api/schedules/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  if (!jobs.length) {
    return <p className="text-sm text-neutral-500">No scheduled jobs. Your agent can create these on request.</p>
  }

  return (
    <div className="space-y-2">
      {jobs.map((j) => (
        <div key={j.id} className="card flex items-start justify-between">
          <div>
            <div className="font-medium">{j.name}</div>
            <p className="mt-1 text-sm text-neutral-600">{j.prompt}</p>
            <div className="mt-1 text-xs text-neutral-500">
              {j.cron ? `Recurring: ${j.cron}` : 'One-off'} ·{' '}
              {j.next_run_at ? `next ${new Date(j.next_run_at).toLocaleString()}` : 'no next run'} ·{' '}
              <span className="capitalize">{j.status}</span>
            </div>
          </div>
          {j.status === 'scheduled' && (
            <button onClick={() => cancel(j.id)} className="btn-outline">
              <X className="h-4 w-4" /> Cancel
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
