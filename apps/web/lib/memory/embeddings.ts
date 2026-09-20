// @ts-nocheck
// Embedding generation for Business Memory (Phase F). Anthropic/Claude has
// no embeddings endpoint, so this uses Voyage AI (Anthropic's own
// recommended embeddings partner) — a separate, optional integration.
// Degrades gracefully: with no VOYAGE_API_KEY, notes are still saved as
// plain text (embedding stays NULL) and semantic search simply returns no
// results rather than erroring — the same "optional integration, never a
// hard dependency" pattern already used for Twilio/Resend elsewhere in
// FoodTaxi.
export const EMBEDDING_MODEL = 'voyage-3-lite'
export const EMBEDDING_DIMENSIONS = 512

export async function getEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey || !text?.trim()) return null
  try {
    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: text.slice(0, 8000), model: EMBEDDING_MODEL }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.data?.[0]?.embedding ?? null
  } catch {
    return null
  }
}
