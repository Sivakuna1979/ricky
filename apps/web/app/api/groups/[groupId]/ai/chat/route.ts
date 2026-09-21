// @ts-nocheck
// M65-M70 — Group AI chat. Resolves group context strictly from the
// authenticated session (never a group_id/role from the request body) —
// the AI cannot broaden its own scope because it never sees the raw
// group_id at all, only the already-scoped tool results.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { resolveGroupContext } from '@/lib/groups/context'
import { hasGroupPermission } from '@/lib/groups/permissions'
import { runGroupAssistant } from '@/lib/ai/groupAssistant'

export async function POST(req: NextRequest, { params }: { params: { groupId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'view_group_dashboard')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'FoodTaxi Group AI is not configured yet.' }, { status: 503 })

  const body = await req.json().catch(() => ({}))
  const message: string = (body.message ?? '').trim()
  if (!message) return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
  if (message.length > 2000) return NextResponse.json({ error: 'Message is too long.' }, { status: 400 })

  // Stateless — the client may resend prior turns; nothing is persisted
  // server-side (see lib/ai/groupAssistant.ts's header comment).
  const priorHistory = Array.isArray(body.history) ? body.history.slice(-10) : []
  const history = [...priorHistory, { role: 'user', content: message }]

  const admin = await createAdminClient()
  const result = await runGroupAssistant(admin, ctx, history)
  return NextResponse.json({ text: result.text, tool_calls: result.toolCalls.map((t: any) => t.tool) })
}
