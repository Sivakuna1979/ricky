// @ts-nocheck
/**
 * PATCH /api/events/[id]  — admin: update any field
 * DELETE /api/events/[id] — admin: delete request
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/isSuperAdmin'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await isSuperAdmin(supabase, user))) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  }
  const body = await req.json().catch(() => ({}))
  const db = await createAdminClient()
  const { error } = await db.from('event_requests').update(body).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!(await isSuperAdmin(supabase, user))) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 403 })
  }
  const db = await createAdminClient()
  const { error } = await db.from('event_requests').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
