// @ts-nocheck
// Clock in (C20) — any active staff member can clock themselves in; this is
// operational time tracking, not a permission-gated management action.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx?.staffId) return NextResponse.json({ error: 'Only staff accounts can clock in' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: open } = await admin.from('time_entries').select('id').eq('staff_id', ctx.staffId).is('clock_out_at', null).maybeSingle()
  if (open) return NextResponse.json({ error: 'Already clocked in — clock out first' }, { status: 409 })

  const body = await req.json().catch(() => ({}))
  const { data, error } = await admin.from('time_entries').insert({
    business_id: ctx.businessId, staff_id: ctx.staffId, van_id: body.van_id ?? null, clock_in_at: new Date().toISOString(),
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
