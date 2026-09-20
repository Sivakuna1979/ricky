// @ts-nocheck
// ============================================================================
// FoodTaxi AI chat endpoint (E1, E2, E4). business/permission context is
// resolved here, server-side, from the authenticated session ONLY — never
// from anything in the request body. See lib/ai/context.ts.
// ============================================================================
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveAiContext } from '@/lib/ai/context'
import { runAssistant } from '@/lib/ai/assistant'

const RATE_LIMIT_MESSAGES_PER_HOUR = 40
const CONTEXT_MESSAGE_LIMIT = 20 // E29 — bounded history, not the whole conversation

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await resolveAiContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No authorised business found for this account.' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const message: string = (body.message ?? '').trim()
  if (!message) return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
  if (message.length > 2000) return NextResponse.json({ error: 'Message is too long.' }, { status: 400 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'FoodTaxi AI is not configured yet.' }, { status: 503 })

  const admin = await createAdminClient()

  // E35 — sensible per-user rate limit, no new table needed.
  const hourAgo = new Date(Date.now() - 3600000).toISOString()
  const { count: recentCount } = await admin
    .from('ai_messages').select('id, ai_conversations!inner(user_id)', { count: 'exact', head: true })
    .eq('role', 'user').eq('ai_conversations.user_id', ctx.userId).gte('created_at', hourAgo)
  if ((recentCount ?? 0) >= RATE_LIMIT_MESSAGES_PER_HOUR) {
    return NextResponse.json({ error: "You've reached the FoodTaxi AI usage limit for now — please try again in a little while." }, { status: 429 })
  }

  // Load or create the conversation — always re-verified against this
  // user, never trusted blindly even if the browser sent an id.
  let conversationId = body.conversation_id as string | undefined
  if (conversationId) {
    const { data: existing } = await admin.from('ai_conversations').select('id').eq('id', conversationId).eq('user_id', ctx.userId).maybeSingle()
    if (!existing) conversationId = undefined
  }
  if (!conversationId) {
    const { data: created, error } = await admin.from('ai_conversations').insert({
      business_id: ctx.businessId, user_id: ctx.userId, title: message.slice(0, 60),
    }).select('id').single()
    if (error) return NextResponse.json({ error: 'Could not start a conversation.' }, { status: 500 })
    conversationId = created.id
  }

  const turnStartedAt = new Date().toISOString()
  await admin.from('ai_messages').insert({ conversation_id: conversationId, role: 'user', content: message })

  const { data: recentMessages } = await admin
    .from('ai_messages').select('role, content').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(CONTEXT_MESSAGE_LIMIT)
  const history = (recentMessages ?? []).reverse()

  const result = await runAssistant(admin, ctx, conversationId, history)

  await admin.from('ai_messages').insert({ conversation_id: conversationId, role: 'assistant', content: result.text, tool_calls: result.toolCalls })
  await admin.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)

  // Surface any pending write-action proposals created during this turn,
  // so the UI can render Confirm/Cancel — the model's text alone is never
  // treated as having executed anything (E24).
  const { data: pendingActions } = await admin
    .from('ai_pending_actions').select('*').eq('conversation_id', conversationId).eq('status', 'PENDING').gte('created_at', turnStartedAt)

  return NextResponse.json({
    conversation_id: conversationId,
    message: result.text,
    sources: (result.toolCalls ?? []).map((tc: any) => tc.tool),
    pending_actions: pendingActions ?? [],
  })
}
