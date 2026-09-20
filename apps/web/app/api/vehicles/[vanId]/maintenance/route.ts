// @ts-nocheck
// Vehicle maintenance history (C24).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest, { params }: { params: { vanId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const { data, error } = await supabase
    .from('vehicle_maintenance').select('*, supplier_records(supplier_name)').eq('van_id', params.vanId).eq('business_id', ctx.businessId).order('maintenance_date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Body: { maintenance_date, mileage?, maintenance_type, description?, supplier_id?, cost?, next_service_date?, next_service_mileage? }
export async function POST(req: NextRequest, { params }: { params: { vanId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_vehicles')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: van } = await admin.from('vans').select('id, business_id').eq('id', params.vanId).maybeSingle()
  if (!van || van.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  if (!body.maintenance_date) return NextResponse.json({ error: 'maintenance_date required' }, { status: 400 })

  const { data, error } = await admin.from('vehicle_maintenance').insert({
    business_id: ctx.businessId, van_id: params.vanId,
    maintenance_date: body.maintenance_date, mileage: body.mileage ?? null,
    maintenance_type: body.maintenance_type ?? 'OTHER', description: body.description ?? null,
    supplier_id: body.supplier_id ?? null, cost: body.cost ?? null,
    next_service_date: body.next_service_date ?? null, next_service_mileage: body.next_service_mileage ?? null,
    created_by: ctx.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Keep the vehicle's own service-due fields in step with the latest
  // maintenance entry that sets them, so the reminder engine (C26) stays
  // current without a separate manual edit.
  if (body.next_service_date || body.next_service_mileage) {
    await admin.from('vehicle_details').upsert({
      van_id: params.vanId, business_id: ctx.businessId,
      service_due_date: body.next_service_date ?? null, service_due_mileage: body.next_service_mileage ?? null,
      mileage: body.mileage ?? undefined, updated_at: new Date().toISOString(),
    }, { onConflict: 'van_id' })
  }

  return NextResponse.json(data, { status: 201 })
}
