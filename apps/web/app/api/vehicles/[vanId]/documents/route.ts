// @ts-nocheck
// Vehicle documents (C23) — metadata only (type, expiry date, optional
// external link) for now; see the migration's comment on vehicle_documents
// for why an upload/private-storage flow isn't built in this phase.
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
    .from('vehicle_documents').select('*').eq('van_id', params.vanId).eq('business_id', ctx.businessId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

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
  if (!body.document_type) return NextResponse.json({ error: 'document_type required' }, { status: 400 })

  const { data, error } = await admin.from('vehicle_documents').insert({
    business_id: ctx.businessId, van_id: params.vanId, document_type: body.document_type,
    file_url: body.file_url ?? null, expiry_date: body.expiry_date ?? null, notes: body.notes ?? null, uploaded_by: ctx.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
