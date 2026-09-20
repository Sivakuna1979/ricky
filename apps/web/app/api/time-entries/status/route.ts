// @ts-nocheck
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx?.staffId) return NextResponse.json({ clocked_in: false })

  const admin = await createAdminClient()
  const { data: open } = await admin.from('time_entries').select('id').eq('staff_id', ctx.staffId).is('clock_out_at', null).maybeSingle()
  return NextResponse.json({ clocked_in: !!open })
}
