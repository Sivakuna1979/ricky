import { createClient } from '@/lib/supabase/server'
import { ApprovalActions } from '@/components/ApprovalActions'

async function loadEntityLabel(supabase: any, entityType: string, entityId: string) {
  switch (entityType) {
    case 'topic': {
      const { data } = await supabase.from('yt_topics').select('title, angle, score').eq('id', entityId).single()
      return data ? `${data.title} (score ${data.score ?? '—'})` : 'Topic'
    }
    case 'script': {
      const { data } = await supabase.from('yt_scripts').select('hook, quality_score, originality_score').eq('id', entityId).single()
      return data ? `Hook: "${data.hook}" — quality ${data.quality_score ?? '—'}/10, originality ${data.originality_score ?? '—'}/10` : 'Script'
    }
    case 'video':
    case 'thumbnail': {
      const { data } = await supabase.from('yt_video_metadata').select('title').eq('video_id', entityId).maybeSingle()
      return data?.title ?? 'Video'
    }
    default:
      return entityType
  }
}

export default async function ApprovalsPage() {
  const supabase = await createClient()
  const { data: approvals } = await supabase
    .from('yt_approvals')
    .select('id, entity_type, entity_id, channel_id, status, created_at, yt_channels(title)')
    .eq('status', 'pending')
    .order('created_at')

  const withLabels = await Promise.all(
    (approvals ?? []).map(async (a: any) => ({ ...a, label: await loadEntityLabel(supabase, a.entity_type, a.entity_id) }))
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Approvals</h1>
      <p className="text-sm text-neutral-600">
        Nothing moves past this queue until you decide — this is what Manual and Assisted Automation modes are waiting on.
      </p>

      {!withLabels.length && <p className="card text-sm text-neutral-500">Nothing waiting on you right now.</p>}

      <div className="space-y-3">
        {withLabels.map((a) => (
          <div key={a.id} className="card">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="badge-blue capitalize">{a.entity_type}</span>
              <span className="text-xs text-neutral-500">{a.yt_channels?.title} · {new Date(a.created_at).toLocaleString()}</span>
            </div>
            <p className="mb-3 text-sm">{a.label}</p>
            <ApprovalActions approvalId={a.id} />
          </div>
        ))}
      </div>
    </div>
  )
}
