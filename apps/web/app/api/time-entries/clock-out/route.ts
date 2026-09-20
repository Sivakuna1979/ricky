// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx?.staffId) return NextResponse.json({ error: 'Only staff accounts can clock out' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: open } = await admin.from('time_entries').select('id').eq('staff_id', ctx.staffId).is('clock_out_at', null).order('clock_in_at', { ascending: false }).limit(1).maybeSingle()
  if (!open) return NextResponse.json({ error: 'Not currently clocked in' }, { status: 409 })

  const { data, error } = await admin.from('time_entries').update({ clock_out_at: new Date().toISOString() }).eq('id', open.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
