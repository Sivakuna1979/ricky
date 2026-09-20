// @ts-nocheck
// Shift scheduling (C19).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('shifts').select('*, staff(id, role, users(full_name, email)), vans(name)')
    .eq('business_id', ctx.businessId).order('shift_date').order('start_time')
  if (from) query = query.gte('shift_date', from)
  if (to) query = query.lte('shift_date', to)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Body: { staff_id, van_id?, shift_date, start_time, end_time, notes? }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_shifts')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const { staff_id, van_id, shift_date, start_time, end_time, notes } = body
  if (!staff_id || !shift_date || !start_time || !end_time) {
    return NextResponse.json({ error: 'staff_id, shift_date, start_time and end_time are required' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { data: staffRow } = await admin.from('staff').select('id, business_id').eq('id', staff_id).maybeSingle()
  if (!staffRow || staffRow.business_id !== ctx.businessId) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })

  const { data, error } = await admin.from('shifts').insert({
    business_id: ctx.businessId, staff_id, van_id: van_id ?? null, shift_date, start_time, end_time, notes: notes ?? null, created_by: ctx.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
