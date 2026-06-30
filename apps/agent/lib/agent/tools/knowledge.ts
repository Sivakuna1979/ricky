import { createAdminClient } from '@/lib/supabase/server'

// Lightweight knowledge-base retrieval using Postgres full-text search over the
// workspace's documents. No external embedding service required.
export async function searchKnowledgeBase(
  workspaceId: string,
  agentId: string | null,
  query: string
): Promise<string> {
  const supabase = createAdminClient()

  let q = supabase
    .from('knowledge_documents')
    .select('title, content')
    .eq('workspace_id', workspaceId)
    .textSearch('fts', query, { type: 'websearch', config: 'english' })
    .limit(4)

  if (agentId) q = q.or(`agent_id.eq.${agentId},agent_id.is.null`)

  const { data, error } = await q
  if (error) return `Knowledge base error: ${error.message}`
  if (!data?.length) return 'No relevant documents found in the knowledge base.'

  return data
    .map((d: any) => `## ${d.title}\n${(d.content as string).slice(0, 1500)}`)
    .join('\n\n')
}
