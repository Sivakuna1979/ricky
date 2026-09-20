// @ts-nocheck
// I46 — publish/unpublish + the business response workflow. Publishing
// is always an explicit business decision, never automatic.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'

// Body: { is_published?, business_response? }
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_reviews')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: existing } = await admin.from('reviews').select('*').eq('id', params.id).eq('business_id', ctx.businessId).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const updates: any = {}
  if (body.is_published !== undefined) updates.is_published = !!body.is_published
  if (body.business_response !== undefined) { updates.business_response = body.business_response; updates.responded_at = new Date().toISOString(); updates.responded_by = ctx.userId }
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data: updated, error } = await admin.from('reviews').update(updates).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(updated)
}
