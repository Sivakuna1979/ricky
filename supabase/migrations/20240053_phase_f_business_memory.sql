-- ============================================================================
-- PHASE F — Business Memory (structured notes + semantic search)
-- ============================================================================
-- This was flagged throughout Phases D/E as explicitly out of scope until
-- now ("Do NOT yet build: vector database, embeddings, semantic document
-- search... that is Phase F"). Scope, deliberately: free-text notes a
-- business writes about itself (route conditions, supplier issues,
-- operational observations), searchable by meaning, not full document/
-- receipt OCR or an accounting system (still out of scope — see baseline
-- doc). Every row is tenant-isolated the same way every other Phase C-F
-- table is: business_id + RLS via my_business_ids()/my_staff_business_ids().
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- Embedding dimension is fixed to whatever model generates it
-- (lib/memory/embeddings.ts uses Voyage AI's voyage-3-lite, 512
-- dimensions) — recorded per-row in embedding_model so a future model
-- change is detectable rather than silently mixing incompatible vectors.
CREATE TABLE IF NOT EXISTS business_memory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES users(id),
  category        TEXT NOT NULL DEFAULT 'general', -- 'general' | 'route_note' | 'supplier_note' | 'event_note' | ...  free-form, not a hard enum
  title           TEXT,
  content         TEXT NOT NULL,
  related_entity_type TEXT, -- e.g. 'van', 'van_schedule', 'stop_visit' — optional link, see Phase G route notes
  related_entity_id   UUID,
  embedding       VECTOR(512),
  embedding_model TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_business_memory_business ON business_memory(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_business_memory_entity ON business_memory(related_entity_type, related_entity_id);
-- No ANN (ivfflat/hnsw) index yet — each business's own memory is a small
-- set (queries are always scoped to one business_id first), so an exact
-- cosine scan within that filtered set is fast enough at this scale.
-- Documented as a candidate addition if a business's note volume grows
-- large (G58/G59 — do not prematurely optimise).

ALTER TABLE business_memory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "business_memory_business" ON business_memory;
CREATE POLICY "business_memory_business" ON business_memory
  FOR ALL USING (business_id IN (SELECT my_business_ids()) OR business_id IN (SELECT my_staff_business_ids()) OR is_super_admin());

-- Semantic search. Deliberately NOT SECURITY DEFINER — it runs with the
-- caller's own privileges, so business_memory's RLS policy above still
-- applies even if this were ever called directly rather than through
-- app/api/memory's own server-side business_id resolution. p_business_id
-- is a belt-and-suspenders explicit filter, not the only protection.
CREATE OR REPLACE FUNCTION match_business_memory(p_business_id UUID, p_query_embedding VECTOR(512), p_limit INT DEFAULT 5)
RETURNS TABLE(id UUID, title TEXT, content TEXT, category TEXT, created_at TIMESTAMPTZ, similarity FLOAT) AS $$
  SELECT id, title, content, category, created_at, 1 - (embedding <=> p_query_embedding) AS similarity
  FROM business_memory
  WHERE business_id = p_business_id AND embedding IS NOT NULL
  ORDER BY embedding <=> p_query_embedding
  LIMIT p_limit
$$ LANGUAGE sql STABLE;
