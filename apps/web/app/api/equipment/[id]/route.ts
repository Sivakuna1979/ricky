// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'

const FIELDS = ['name', 'type', 'serial_number', 'installed_date', 'service_date', 'next_service_date', 'warranty_expiry', 'notes', 'status', 'van_id', 'location_id']

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_vehicles')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: existing } = await admin.from('equipment').select('id, business_id').eq('id', params.id).maybeSingle()
  if (!existing || existing.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const f of FIELDS) if (f in body) update[f] = body[f]

  const { data, error } = await admin.from('equipment').update(update).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_vehicles')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: existing } = await admin.from('equipment').select('id, business_id').eq('id', params.id).maybeSingle()
  if (!existing || existing.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await admin.from('equipment').update({ status: 'retired' }).eq('id', params.id)
  return NextResponse.json({ ok: true })
}
