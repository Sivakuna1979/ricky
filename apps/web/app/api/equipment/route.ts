// @ts-nocheck
// Equipment management (C25).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const { data, error } = await supabase
    .from('equipment').select('*, vans(name), stock_locations(name)').eq('business_id', ctx.businessId).order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_vehicles')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data, error } = await admin.from('equipment').insert({
    business_id: ctx.businessId, van_id: body.van_id ?? null, location_id: body.location_id ?? null,
    name: body.name, type: body.type ?? null, serial_number: body.serial_number ?? null,
    installed_date: body.installed_date ?? null, service_date: body.service_date ?? null,
    next_service_date: body.next_service_date ?? null, warranty_expiry: body.warranty_expiry ?? null, notes: body.notes ?? null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
