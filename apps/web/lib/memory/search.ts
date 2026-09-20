// @ts-nocheck
import { getEmbedding } from './embeddings'

// Semantic search scoped to one business — businessId always comes from
// server-resolved session context (lib/staffContext.ts / lib/ai/context.ts),
// never from the caller's request body.
export async function searchBusinessMemory(admin: any, businessId: string, query: string, limit = 5) {
  const embedding = await getEmbedding(query)
  if (!embedding) return { results: [], semantic: false } // no embeddings configured — caller falls back to plain listing

  const { data, error } = await admin.rpc('match_business_memory', {
    p_business_id: businessId, p_query_embedding: embedding, p_limit: limit,
  })
  if (error) return { results: [], semantic: false, error: error.message }
  return { results: data ?? [], semantic: true }
}
