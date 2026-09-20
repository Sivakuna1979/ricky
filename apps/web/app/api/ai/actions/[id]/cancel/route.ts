// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveAiContext } from '@/lib/ai/context'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await resolveAiContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No authorised business found for this account.' }, { status: 404 })

  const admin = await createAdminClient()
  const { data: claimed } = await admin
    .from('ai_pending_actions').update({ status: 'CANCELLED' })
    .eq('id', params.id).eq('user_id', ctx.userId).eq('business_id', ctx.businessId).eq('status', 'PENDING')
    .select('id').maybeSingle()
  if (!claimed) return NextResponse.json({ error: 'Not found or already handled.' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
