import { createClient } from '@/lib/supabase/server'
import { RegenerateButton } from '@/components/RegenerateButton'

export default async function ScriptsPage() {
  const supabase = await createClient()
  const { data: scripts } = await supabase
    .from('yt_scripts')
    .select('id, hook, content, word_count, quality_score, originality_score, hook_repetition_flag, status, created_at, yt_topics(title, channel_id, yt_channels(title))')
    .order('created_at', { ascending: false })
    .limit(30)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Scripts</h1>
      <div className="space-y-3">
        {scripts?.map((s: any) => (
          <details key={s.id} className="card">
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{s.yt_topics?.title}</div>
                  <p className="mt-1 text-sm italic text-neutral-600">"{s.hook}"</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-neutral-500">
                    <span>{s.yt_topics?.yt_channels?.title}</span>
                    <span>· {s.word_count} words</span>
                    <span>· quality {s.quality_score ?? '—'}/10</span>
                    <span>· originality {s.originality_score ?? '—'}/10</span>
                    {s.hook_repetition_flag && <span className="badge-amber">hook repeated</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="badge-gray capitalize">{s.status.replace('_', ' ')}</span>
                  <RegenerateButton kind="scripts" id={s.id} />
                </div>
              </div>
            </summary>
            <p className="mt-3 whitespace-pre-wrap border-t border-neutral-100 pt-3 text-sm text-neutral-700">{s.content}</p>
          </details>
        ))}
        {!scripts?.length && <p className="card text-sm text-neutral-500">No scripts generated yet.</p>}
      </div>
    </div>
  )
}
