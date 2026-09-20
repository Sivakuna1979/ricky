// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/auditLog'

const FIELDS = ['make', 'model', 'year', 'fuel_type', 'vin', 'mot_expiry', 'insurance_expiry', 'tax_expiry', 'service_due_date', 'service_due_mileage', 'mileage', 'notes']

export async function GET(req: NextRequest, { params }: { params: { vanId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const { data: van } = await supabase.from('vans').select('id, name, registration_plate, business_id').eq('id', params.vanId).maybeSingle()
  if (!van || van.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: details } = await supabase.from('vehicle_details').select('*').eq('van_id', params.vanId).maybeSingle()
  return NextResponse.json({ ...van, ...details })
}

// Upsert — most businesses will just be filling this in once.
export async function PATCH(req: NextRequest, { params }: { params: { vanId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_vehicles')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: van } = await admin.from('vans').select('id, business_id').eq('id', params.vanId).maybeSingle()
  if (!van || van.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const update: Record<string, any> = { van_id: params.vanId, business_id: ctx.businessId, updated_at: new Date().toISOString() }
  for (const f of FIELDS) if (f in body) update[f] = body[f]

  const { data: before } = await admin.from('vehicle_details').select('*').eq('van_id', params.vanId).maybeSingle()
  const { data, error } = await admin.from('vehicle_details').upsert(update, { onConflict: 'van_id' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent(admin, {
    actorId: ctx.userId, action: 'vehicle.details_updated', entityType: 'vehicle', entityId: params.vanId,
    oldValues: before, newValues: data,
  })

  return NextResponse.json(data)
}
