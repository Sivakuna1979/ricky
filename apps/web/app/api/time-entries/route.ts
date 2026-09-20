// @ts-nocheck
// Timesheets (C21) — Today/This Week/custom range, by staff/van/date.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const staffId = searchParams.get('staff_id')

  let query = supabase
    .from('time_entries').select('*, staff(id, role, users(full_name, email)), vans(name)')
    .eq('business_id', ctx.businessId).order('clock_in_at', { ascending: false })
  if (from) query = query.gte('clock_in_at', from)
  if (to) query = query.lte('clock_in_at', to)
  if (staffId) query = query.eq('staff_id', staffId)
  const { data, error } = await query.limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const entries = (data ?? []).map((e: any) => ({
    ...e,
    duration_minutes: e.clock_out_at ? Math.round((new Date(e.clock_out_at).getTime() - new Date(e.clock_in_at).getTime()) / 60000) : null,
  }))
  const totalMinutes = entries.reduce((s: number, e: any) => s + (e.duration_minutes ?? 0), 0)

  return NextResponse.json({ entries, total_hours: Math.round((totalMinutes / 60) * 100) / 100 })
}
