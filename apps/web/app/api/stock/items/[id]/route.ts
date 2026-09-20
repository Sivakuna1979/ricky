// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_stock')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: existing } = await admin.from('stock_items').select('id, business_id').eq('id', params.id).maybeSingle()
  if (!existing || existing.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const allowed = ['name', 'category', 'sku', 'barcode', 'unit', 'pack_size', 'minimum_quantity', 'reorder_quantity', 'cost_price', 'supplier_id', 'expiry_tracking', 'active']
  const update: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (k in body) update[k] = body[k]

  const { data, error } = await admin.from('stock_items').update(update).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Deactivate, never hard-delete — preserves stock_movements history integrity.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_stock')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: existing } = await admin.from('stock_items').select('id, business_id').eq('id', params.id).maybeSingle()
  if (!existing || existing.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await admin.from('stock_items').update({ active: false }).eq('id', params.id)
  return NextResponse.json({ ok: true })
}
