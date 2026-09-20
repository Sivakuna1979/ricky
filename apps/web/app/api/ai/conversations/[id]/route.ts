// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveAiContext } from '@/lib/ai/context'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await resolveAiContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No authorised business found for this account.' }, { status: 404 })

  const admin = await createAdminClient()
  const { data: conversation } = await admin.from('ai_conversations').select('id, title').eq('id', params.id).eq('user_id', ctx.userId).maybeSingle()
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: messages } = await admin.from('ai_messages').select('id, role, content, created_at').eq('conversation_id', params.id).order('created_at')
  const { data: pendingActions } = await admin.from('ai_pending_actions').select('*').eq('conversation_id', params.id).eq('status', 'PENDING')

  return NextResponse.json({ ...conversation, messages: messages ?? [], pending_actions: pendingActions ?? [] })
}

// Deletes only this user's own chat history — never touches any
// underlying business record (E28).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await resolveAiContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No authorised business found for this account.' }, { status: 404 })

  const admin = await createAdminClient()
  const { data: existing } = await admin.from('ai_conversations').select('id').eq('id', params.id).eq('user_id', ctx.userId).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await admin.from('ai_conversations').delete().eq('id', params.id)
  return NextResponse.json({ ok: true })
}
