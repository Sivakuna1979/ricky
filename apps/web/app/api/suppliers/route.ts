// @ts-nocheck
// Supplier directory (C11) — built on the existing supplier_records table
// (previously unused by any code), not a new table.
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
    .from('supplier_records').select('*').eq('business_id', ctx.businessId).eq('is_active', true).order('supplier_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_suppliers')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  if (!body.supplier_name) return NextResponse.json({ error: 'supplier_name required' }, { status: 400 })

  const admin = await createAdminClient()
  const { data, error } = await admin.from('supplier_records').insert({
    business_id: ctx.businessId,
    supplier_name: body.supplier_name,
    contact_name: body.contact_name ?? null,
    phone: body.phone ?? null,
    email: body.email ?? null,
    website: body.website ?? null,
    account_reference: body.account_reference ?? null,
    address: body.address ?? null,
    notes: body.notes ?? null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
