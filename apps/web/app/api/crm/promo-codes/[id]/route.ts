// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/auditLog'

// Body: { is_active } — the only field changed after creation; edit the
// rest by creating a new code instead of mutating a live one's terms.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_promotions')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: existing } = await admin.from('promo_codes').select('*').eq('id', params.id).eq('business_id', ctx.businessId).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { is_active } = await req.json()
  const { data: updated } = await admin.from('promo_codes').update({ is_active: !!is_active }).eq('id', params.id).select().single()
  await logAuditEvent(admin, { actorId: ctx.userId, action: 'crm.promo_changed', entityType: 'promo_codes', entityId: params.id, oldValues: { is_active: existing.is_active }, newValues: { is_active: updated.is_active } })
  return NextResponse.json(updated)
}
