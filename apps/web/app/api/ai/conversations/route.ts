// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveAiContext } from '@/lib/ai/context'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await resolveAiContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No authorised business found for this account.' }, { status: 404 })

  const admin = await createAdminClient()
  const { data, error } = await admin.from('ai_conversations').select('id, title, updated_at').eq('user_id', ctx.userId).order('updated_at', { ascending: false }).limit(30)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
