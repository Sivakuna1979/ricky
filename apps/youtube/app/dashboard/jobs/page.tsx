import { createClient } from '@/lib/supabase/server'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { queued: 'badge-gray', running: 'badge-amber', completed: 'badge-green', failed: 'badge-red', retrying: 'badge-amber' }
  return <span className={map[status] ?? 'badge-gray'}>{status}</span>
}

export default async function JobsPage() {
  const supabase = await createClient()
  const { data: jobs } = await supabase
    .from('yt_job_logs')
    .select('id, job_name, queue, status, attempt, error_message, duration_ms, created_at, yt_channels(title)')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Job history</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="py-2 pr-3">Job</th>
              <th className="py-2 pr-3">Channel</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Attempt</th>
              <th className="py-2 pr-3">Duration</th>
              <th className="py-2 pr-3">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {jobs?.map((j: any) => (
              <tr key={j.id}>
                <td className="py-2 pr-3">{j.job_name}</td>
                <td className="py-2 pr-3">{j.yt_channels?.title ?? '—'}</td>
                <td className="py-2 pr-3">
                  <StatusBadge status={j.status} />
                  {j.error_message && <div className="mt-1 max-w-md truncate text-xs text-red-600" title={j.error_message}>{j.error_message}</div>}
                </td>
                <td className="py-2 pr-3">{j.attempt}</td>
                <td className="py-2 pr-3">{j.duration_ms ? `${(j.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                <td className="py-2 pr-3">{new Date(j.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!jobs?.length && <p className="py-4 text-sm text-neutral-500">No jobs run yet.</p>}
      </div>
    </div>
  )
}
