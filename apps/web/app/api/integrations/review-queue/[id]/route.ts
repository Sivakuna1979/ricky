// @ts-nocheck
// L45/L46 — a human resolves or dismisses a review item. This route never
// "fixes" the underlying mismatch itself (no auto-matching) — it only
// records that a human looked at it and what they decided.
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/auditLog'

// Body: { action: 'resolve' | 'dismiss' }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_payment_integrations')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { action } = await req.json()
  if (!['resolve', 'dismiss'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: item } = await admin.from('reconciliation_review_items').select('id, business_id, status').eq('id', params.id).maybeSingle()
  if (!item || item.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (item.status !== 'OPEN') return NextResponse.json({ error: 'Already handled' }, { status: 409 })

  const newStatus = action === 'resolve' ? 'RESOLVED' : 'DISMISSED'
  const { data: updated } = await admin.from('reconciliation_review_items').update({ status: newStatus, resolved_at: new Date().toISOString(), resolved_by: ctx.userId }).eq('id', item.id).eq('status', 'OPEN').select().maybeSingle()
  if (!updated) return NextResponse.json({ error: 'Already handled' }, { status: 409 })

  await logAuditEvent(admin, { actorId: ctx.userId, action: `integrations.review_item_${newStatus.toLowerCase()}`, entityType: 'reconciliation_review_items', entityId: item.id })
  return NextResponse.json(updated)
}
