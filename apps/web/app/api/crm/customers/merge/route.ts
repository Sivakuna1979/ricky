// @ts-nocheck
// I3/I66 — safe, auditable manual merge. Never automatic, never by name
// similarity — the caller must supply two real crm_customers ids they
// have reviewed.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { mergeCrmCustomers } from '@/lib/crm/identity'
import { logAuditEvent } from '@/lib/auditLog'

// Body: { keep_id, merge_from_id }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_crm_settings')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { keep_id, merge_from_id } = await req.json()
  if (!keep_id || !merge_from_id) return NextResponse.json({ error: 'keep_id and merge_from_id are required' }, { status: 400 })

  const admin = await createAdminClient()
  try {
    const result = await mergeCrmCustomers(admin, ctx.businessId, keep_id, merge_from_id, ctx.userId)
    await logAuditEvent(admin, { actorId: ctx.userId, action: 'crm.customer_merged', entityType: 'crm_customers', entityId: keep_id, newValues: result })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'merge_failed' }, { status: 400 })
  }
}
