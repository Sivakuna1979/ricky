import { createClient } from '@/lib/supabase/server'
import { NicheTool } from '@/components/NicheTool'

export default async function NichesPage() {
  const supabase = await createClient()
  const { data: niches } = await supabase.from('yt_niches').select('*').order('overall_score', { ascending: false })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Niche selection tool</h1>
      <p className="text-sm text-neutral-600">
        Compare candidate niches before committing a channel to one. Medical, legal, financial, political,
        tragic-event, celebrity-rumour and children's content are flagged automatically and blocked from
        automation until you explicitly acknowledge the extra safeguards they need.
      </p>

      <NicheTool />

      <div className="card overflow-x-auto">
        <h2 className="mb-2 font-semibold">Saved niches</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Overall</th>
              <th className="py-2 pr-3">Sensitive?</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {niches?.map((n) => (
              <tr key={n.id}>
                <td className="py-2 pr-3">{n.name}</td>
                <td className="py-2 pr-3">{n.overall_score}/10</td>
                <td className="py-2 pr-3">
                  {n.is_sensitive ? (
                    <span className={n.safeguards_acknowledged ? 'badge-amber' : 'badge-red'}>
                      {n.sensitive_category}{n.safeguards_acknowledged ? ' (ack’d)' : ' — blocked'}
                    </span>
                  ) : <span className="badge-green">no</span>}
                </td>
                <td className="py-2 pr-3 capitalize">{n.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!niches?.length && <p className="py-4 text-sm text-neutral-500">No niches scored yet.</p>}
      </div>
    </div>
  )
}
