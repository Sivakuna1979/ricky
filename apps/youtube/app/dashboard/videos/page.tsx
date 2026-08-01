import { createClient } from '@/lib/supabase/server'
import { getSignedMediaUrl } from '@/lib/storage'
import { RegenerateButton } from '@/components/RegenerateButton'

export default async function VideosPage() {
  const supabase = await createClient()
  const { data: videos } = await supabase
    .from('yt_videos')
    .select(`
      id, aspect_ratio, video_kind, render_status, storage_path, quality_score, duration_seconds, created_at,
      yt_channels(title),
      yt_video_metadata(title, description),
      yt_thumbnails(storage_path, is_selected),
      yt_policy_checks(check_type, passed, severity),
      yt_copyright_checks(check_type, passed)
    `)
    .order('created_at', { ascending: false })
    .limit(20)

  const withUrls = await Promise.all(
    (videos ?? []).map(async (v: any) => ({
      ...v,
      videoUrl: await getSignedMediaUrl(v.storage_path),
      thumbUrl: await getSignedMediaUrl(v.yt_thumbnails?.find((t: any) => t.is_selected)?.storage_path ?? v.yt_thumbnails?.[0]?.storage_path ?? null),
    }))
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Videos & thumbnails</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {withUrls.map((v) => {
          const policyWarnings = (v.yt_policy_checks ?? []).filter((c: any) => !c.passed)
          const copyrightWarnings = (v.yt_copyright_checks ?? []).filter((c: any) => !c.passed)
          return (
            <div key={v.id} className="card">
              {v.thumbUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.thumbUrl} alt="thumbnail" className={`w-full rounded-lg object-cover ${v.aspect_ratio === '9:16' ? 'aspect-[9/16]' : 'aspect-video'}`} />
              )}
              <div className="mt-3 font-medium">{v.yt_video_metadata?.[0]?.title ?? '(untitled — render in progress)'}</div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-neutral-500">
                <span>{v.yt_channels?.title}</span>
                <span>· {v.aspect_ratio}</span>
                <span>· render: {v.render_status}</span>
                <span>· quality {v.quality_score ?? '—'}/10</span>
              </div>
              {(policyWarnings.length > 0 || copyrightWarnings.length > 0) && (
                <div className="mt-2 space-y-1">
                  {policyWarnings.map((c: any, i: number) => (
                    <div key={i} className="badge-red">policy: {c.check_type}</div>
                  ))}
                  {copyrightWarnings.map((c: any, i: number) => (
                    <div key={i} className="badge-red">copyright: {c.check_type}</div>
                  ))}
                </div>
              )}
              {v.videoUrl && (
                <video controls className="mt-3 w-full rounded-lg" src={v.videoUrl} preload="none" />
              )}
              <div className="mt-3">
                <RegenerateButton kind="videos" id={v.id} />
              </div>
            </div>
          )
        })}
        {!withUrls.length && <p className="card text-sm text-neutral-500">No videos produced yet.</p>}
      </div>
    </div>
  )
}
