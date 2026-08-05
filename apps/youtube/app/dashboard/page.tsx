import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { RunNowButton } from '@/components/RunNowButton'

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'filled' || status === 'published'
      ? 'badge-green'
      : status === 'failed'
        ? 'badge-red'
        : status === 'skipped'
          ? 'badge-gray'
          : 'badge-amber'
  return <span className={cls}>{status}</span>
}

export default async function TodayPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [{ data: schedules }, { count: pendingApprovalsCount }, { count: failedJobsCount }, { data: profile }] = await Promise.all([
    supabase
      .from('yt_schedules')
      .select('id, slot_time, video_kind, status, yt_channels(title), yt_videos(id, quality_score, yt_video_metadata(title))')
      .eq('slot_date', today)
      .order('slot_time'),
    supabase.from('yt_approvals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase
      .from('yt_job_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
    supabase.from('yt_profiles').select('daily_spend_limit_usd, monthly_spend_limit_usd').single(),
  ])

  const { data: dailySpend } = await supabase.rpc('yt_spend_for_user', {
    p_user_id: (await supabase.auth.getUser()).data.user?.id,
    p_since: new Date(new Date().setHours(0, 0, 0, 0)).toISOString(),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Today</h1>
          <p className="mt-1 text-sm text-neutral-600">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <RunNowButton />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Link href="/dashboard/approvals" className="card hover:shadow-md">
          <div className="text-2xl font-bold">{pendingApprovalsCount ?? 0}</div>
          <div className="text-sm text-neutral-600">Awaiting your approval</div>
        </Link>
        <Link href="/dashboard/jobs" className="card hover:shadow-md">
          <div className="text-2xl font-bold">{failedJobsCount ?? 0}</div>
          <div className="text-sm text-neutral-600">Failed jobs (24h)</div>
        </Link>
        <Link href="/dashboard/costs" className="card hover:shadow-md">
          <div className="text-2xl font-bold">${Number(dailySpend ?? 0).toFixed(2)}</div>
          <div className="text-sm text-neutral-600">Spent today / ${Number(profile?.daily_spend_limit_usd ?? 0).toFixed(0)} limit</div>
        </Link>
        <Link href="/dashboard/uploads" className="card hover:shadow-md">
          <div className="text-2xl font-bold">{schedules?.filter((s) => s.status === 'filled').length ?? 0}/{schedules?.length ?? 0}</div>
          <div className="text-sm text-neutral-600">Today's slots filled</div>
        </Link>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Today's planned videos</h2>
        {!schedules?.length && <p className="text-sm text-neutral-500">No slots scheduled for today yet — hit "Run now" or wait for the next cron run.</p>}
        <ul className="divide-y divide-neutral-100">
          {schedules?.map((s: any) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <div className="font-medium">{s.yt_videos?.[0]?.yt_video_metadata?.[0]?.title ?? `${s.video_kind === 'short' ? 'Short' : 'Long-form'} — not produced yet`}</div>
                <div className="text-xs text-neutral-500">{s.yt_channels?.title} · {s.slot_time} · {s.video_kind}</div>
              </div>
              <StatusBadge status={s.status} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
