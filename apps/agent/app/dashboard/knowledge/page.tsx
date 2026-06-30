import { getCurrentContext } from '@/lib/workspace'
import { createClient } from '@/lib/supabase/server'
import KnowledgeManager from '@/components/KnowledgeManager'
import type { KnowledgeDocument } from '@/lib/types'

export default async function KnowledgePage() {
  const { workspace } = await getCurrentContext()
  if (!workspace) return null
  const supabase = await createClient()
  const { data: docs } = await supabase
    .from('knowledge_documents')
    .select('*')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">Knowledge base</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Documents your agent can search to answer customer questions accurately.
      </p>
      <div className="mt-6">
        <KnowledgeManager docs={(docs ?? []) as KnowledgeDocument[]} />
      </div>
    </div>
  )
}
