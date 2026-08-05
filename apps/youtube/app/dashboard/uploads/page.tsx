import { createClient } from '@/lib/supabase/server'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'badge-gray', uploading: 'badge-amber', uploaded: 'badge-blue',
    scheduled: 'badge-blue', published: 'badge-green', failed: 'badge-red',
  }
  return <span className={map[status] ?? 'badge-gray'}>{status}</span>
}

export default async function UploadsPage() {
  const supabase = await createClient()
  const { data: uploads } = await supabase
    .from('yt_uploads')
    .select('id, youtube_video_id, upload_status, privacy_status, publish_at, published_at, error_message, retry_count, created_at, yt_channels(title), yt_videos(yt_video_metadata(title))')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Uploads</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="py-2 pr-3">Title</th>
              <th className="py-2 pr-3">Channel</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Publish at</th>
              <th className="py-2 pr-3">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {uploads?.map((u: any) => (
              <tr key={u.id}>
                <td className="py-2 pr-3">{u.yt_videos?.yt_video_metadata?.[0]?.title ?? '—'}</td>
                <td className="py-2 pr-3">{u.yt_channels?.title}</td>
                <td className="py-2 pr-3">
                  <StatusBadge status={u.upload_status} />
                  {u.error_message && <div className="mt-1 max-w-xs truncate text-xs text-red-600" title={u.error_message}>{u.error_message}</div>}
                </td>
                <td className="py-2 pr-3">{u.publish_at ? new Date(u.publish_at).toLocaleString() : '—'}</td>
                <td className="py-2 pr-3">
                  {u.youtube_video_id ? (
                    <a className="text-brand underline" href={`https://youtu.be/${u.youtube_video_id}`} target="_blank" rel="noreferrer">watch</a>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!uploads?.length && <p className="py-4 text-sm text-neutral-500">No uploads yet.</p>}
      </div>
    </div>
  )
}
