import { createClient } from '@/lib/supabase/server'
import { RegenerateButton } from '@/components/RegenerateButton'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    proposed: 'badge-amber', approved: 'badge-blue', in_production: 'badge-blue',
    used: 'badge-green', rejected: 'badge-red', archived: 'badge-gray',
  }
  return <span className={map[status] ?? 'badge-gray'}>{status.replace('_', ' ')}</span>
}

export default async function TopicsPage() {
  const supabase = await createClient()
  const { data: topics } = await supabase
    .from('yt_topics')
    .select('id, title, angle, video_type, format, score, status, is_sensitive_topic, created_at, yt_channels(title)')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Topic ideas</h1>
      <div className="space-y-3">
        {topics?.map((t: any) => (
          <div key={t.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-medium">{t.title}</div>
                <p className="mt-1 text-sm text-neutral-600">{t.angle}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <span>{t.yt_channels?.title}</span>
                  <span>·</span>
                  <span className="capitalize">{t.video_type} / {t.format}</span>
                  <span>·</span>
                  <span>Score {t.score ?? '—'}/10</span>
                  {t.is_sensitive_topic && <span className="badge-amber">sensitive niche</span>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={t.status} />
                {(t.status === 'used' || t.status === 'rejected' || t.status === 'in_production') && (
                  <RegenerateButton kind="topics" id={t.id} />
                )}
              </div>
            </div>
          </div>
        ))}
        {!topics?.length && <p className="card text-sm text-neutral-500">No topics generated yet.</p>}
      </div>
    </div>
  )
}
