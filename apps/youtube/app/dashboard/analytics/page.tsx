import { createClient } from '@/lib/supabase/server'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('yt_analytics')
    .select('views, likes, comments, subscribers_gained, metric_date, yt_videos(video_kind, yt_video_metadata(title), yt_channels(title))')
    .order('metric_date', { ascending: false })
    .limit(100)

  const totals = (rows ?? []).reduce(
    (acc, r) => ({ views: acc.views + r.views, likes: acc.likes + r.likes, comments: acc.comments + r.comments, subs: acc.subs + r.subscribers_gained }),
    { views: 0, likes: 0, comments: 0, subs: 0 }
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">YouTube statistics</h1>
      <p className="text-sm text-neutral-600">
        Basic per-video stats sync hourly via the YouTube Data API. Deeper metrics (impressions, CTR, audience
        retention curves, traffic sources, Shorts swipe-away rate) require the YouTube Analytics API and are
        wired up once a channel has enough published history — see CHECKLIST.md.
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card"><div className="text-2xl font-bold">{totals.views}</div><div className="text-sm text-neutral-600">Views</div></div>
        <div className="card"><div className="text-2xl font-bold">{totals.likes}</div><div className="text-sm text-neutral-600">Likes</div></div>
        <div className="card"><div className="text-2xl font-bold">{totals.comments}</div><div className="text-sm text-neutral-600">Comments</div></div>
        <div className="card"><div className="text-2xl font-bold">{totals.subs}</div><div className="text-sm text-neutral-600">Subscribers gained</div></div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="py-2 pr-3">Video</th>
              <th className="py-2 pr-3">Channel</th>
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Views</th>
              <th className="py-2 pr-3">Likes</th>
              <th className="py-2 pr-3">Comments</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows?.map((r: any, i: number) => (
              <tr key={i}>
                <td className="py-2 pr-3">{r.yt_videos?.yt_video_metadata?.[0]?.title ?? '—'}</td>
                <td className="py-2 pr-3">{r.yt_videos?.yt_channels?.title}</td>
                <td className="py-2 pr-3">{r.metric_date}</td>
                <td className="py-2 pr-3">{r.views}</td>
                <td className="py-2 pr-3">{r.likes}</td>
                <td className="py-2 pr-3">{r.comments}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows?.length && <p className="py-4 text-sm text-neutral-500">No analytics synced yet.</p>}
      </div>
    </div>
  )
}
