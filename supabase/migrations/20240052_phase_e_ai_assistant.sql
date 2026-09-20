-- ============================================================================
-- PHASE E — FoodTaxi AI business assistant
-- ============================================================================
-- Three new tables, all personal-to-the-user (chat history + pending
-- confirmations), scoped by both business_id and user_id. No raw database
-- access is ever granted to the AI itself — see app/api/ai/chat/route.ts
-- and lib/ai/tools/*.ts, which are the only things that ever query
-- business data on the AI's behalf, using the service-role client after
-- the caller's own business/permission context has already been resolved
-- server-side (lib/staffContext.ts) exactly like every other Phase
-- B/C/D route.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON ai_conversations(user_id, updated_at);

-- tool_calls records: [{ tool, args, result_summary }] — the tool NAME and
-- the VALIDATED arguments actually executed, plus a short human-readable
-- summary of what came back (e.g. "Revenue: £142.50, 12 orders"). This is
-- audit/transparency data (E30/E39), not the model's internal reasoning —
-- FoodTaxi never stores hidden chain-of-thought (E39), and never stores
-- full raw tool payloads here either (E26 — those were already minimal,
-- aggregated query results, not raw table dumps, before they even reached
-- Claude).
CREATE TABLE IF NOT EXISTS ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  tool_calls      JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id, created_at);

-- Server-controlled pending write actions (E22–E24). Claude can only ever
-- PROPOSE a row here (via a tool call) — it never has the ability to move
-- a row to CONFIRMED or EXECUTED itself. Only an authenticated user's own
-- explicit POST to /api/ai/actions/[id]/confirm can do that, and that
-- route re-validates user/business/permission/expiry before executing
-- exactly once (status transition PENDING -> CONFIRMED -> EXECUTED is
-- itself the replay guard: confirming twice, or confirming an expired or
-- already-executed action, is rejected by the WHERE clause, the same
-- compare-and-set pattern Phase D's claimRun() uses).
CREATE TABLE IF NOT EXISTS ai_pending_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  action_type     TEXT NOT NULL,
  params          JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'EXECUTED', 'EXPIRED', 'CANCELLED', 'FAILED')),
  expires_at      TIMESTAMPTZ NOT NULL,
  result          JSONB,
  created_at      TIMESTAMPTZ DEFAULT now(),
  confirmed_at    TIMESTAMPTZ,
  executed_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_user ON ai_pending_actions(user_id, status);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pending_actions ENABLE ROW LEVEL SECURITY;

-- Personal to the user (same pattern as the pre-existing `notifications`
-- table) — a conversation belongs to the one person who had it, not to
-- "the business" broadly; a colleague does not see another colleague's
-- chat history.
DROP POLICY IF EXISTS "ai_conversations_own" ON ai_conversations;
CREATE POLICY "ai_conversations_own" ON ai_conversations
  FOR ALL USING (user_id = auth_user_id() OR is_super_admin());

DROP POLICY IF EXISTS "ai_messages_own" ON ai_messages;
CREATE POLICY "ai_messages_own" ON ai_messages
  FOR ALL USING (
    conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = auth_user_id())
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "ai_pending_actions_own" ON ai_pending_actions;
CREATE POLICY "ai_pending_actions_own" ON ai_pending_actions
  FOR ALL USING (user_id = auth_user_id() OR is_super_admin());
