// @ts-nocheck
// M34/M67/M73 — optional "I've read this" tracking. Deliberately never
// described anywhere as certification/competency — just a timestamp.
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: Request, { params }: { params: { groupId: string; id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: userData } = await supabase.from('users').select('id').eq('auth_id', user.id).maybeSingle()
  if (!userData?.id) return NextResponse.json({ error: 'No profile found' }, { status: 404 })

  const { business_id } = await req.json().catch(() => ({}))
  const admin = await createAdminClient()
  const { data: doc } = await admin.from('group_documents').select('id, group_id').eq('id', params.id).eq('group_id', params.groupId).maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await admin.from('group_document_acknowledgements').upsert({
    document_id: doc.id, user_id: userData.id, business_id: business_id ?? null, acknowledged_at: new Date().toISOString(),
  }, { onConflict: 'document_id,user_id' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
