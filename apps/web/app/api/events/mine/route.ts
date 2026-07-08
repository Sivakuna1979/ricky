// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Van owner's applications, looked up by the email they applied with.
// Only their own applications + safe event fields — never customer contacts.
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.trim()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: apps, error } = await admin
    .from('event_applications')
    .select('id, event_id, status, notes, created_at, paid_at, fee, business_name')
    .ilike('van_owner_email', email)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const eventIds = [...new Set((apps ?? []).map((a: any) => a.event_id))]
  const { data: events } = eventIds.length
    ? await admin.from('event_requests').select('id, event_date, event_time, event_type, event_location, region, foodtaxi_fee').in('id', eventIds)
    : { data: [] }
  const evMap = Object.fromEntries((events ?? []).map((e: any) => [e.id, e]))

  return NextResponse.json({
    applications: (apps ?? []).map((a: any) => ({ ...a, event: evMap[a.event_id] ?? null })),
  })
}
