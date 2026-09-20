// @ts-nocheck
// Stock locations (C3) — warehouse/main storage/per-van. A 'van' location
// is 1:1 with a van (enforced by a unique partial index in the migration).
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

  const { data, error } = await supabase
    .from('stock_locations').select('*, vans(name)').eq('business_id', ctx.businessId).eq('is_active', true).order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_stock')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const admin = await createAdminClient()
  if (body.van_id) {
    const { data: van } = await admin.from('vans').select('id, business_id').eq('id', body.van_id).maybeSingle()
    if (!van || van.business_id !== ctx.businessId) return NextResponse.json({ error: 'Van not found for this business' }, { status: 403 })
  }

  const { data, error } = await admin.from('stock_locations').insert({
    business_id: ctx.businessId,
    name: body.name,
    type: body.van_id ? 'van' : (body.type ?? 'other'),
    van_id: body.van_id ?? null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
