// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const { data, error } = await supabase
    .from('equipment_maintenance').select('*, supplier_records(supplier_name)').eq('equipment_id', params.id).eq('business_id', ctx.businessId).order('maintenance_date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_vehicles')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: equipment } = await admin.from('equipment').select('id, business_id').eq('id', params.id).maybeSingle()
  if (!equipment || equipment.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  if (!body.maintenance_date) return NextResponse.json({ error: 'maintenance_date required' }, { status: 400 })

  const { data, error } = await admin.from('equipment_maintenance').insert({
    business_id: ctx.businessId, equipment_id: params.id, maintenance_date: body.maintenance_date,
    description: body.description ?? null, cost: body.cost ?? null, supplier_id: body.supplier_id ?? null, created_by: ctx.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (body.next_service_date) {
    await admin.from('equipment').update({ next_service_date: body.next_service_date, service_date: body.maintenance_date }).eq('id', params.id)
  }

  return NextResponse.json(data, { status: 201 })
}
