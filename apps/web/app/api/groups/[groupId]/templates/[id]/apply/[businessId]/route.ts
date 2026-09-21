// @ts-nocheck
// M22/M56 — the "authorised application" step. Business-side action only
// (requires manage_menu on the target business, not any group role) —
// applying a group's template to YOUR OWN menu is your own business
// decision, never something the group can force through this endpoint.
// `params.id` here is the group_menu_template_applications row id (not
// the template id) — the proposal addressed specifically to this business.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { applyMenuTemplateToBusiness } from '@/lib/groups/menuTemplates'
import { logAuditEvent } from '@/lib/auditLog'

// Body: { action: 'apply' | 'reject' }
export async function PATCH(req: NextRequest, { params }: { params: { groupId: string; id: string; businessId: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const staffCtx = await getStaffContext(supabase, user.id, params.businessId)
  if (!staffCtx || !hasPermission(staffCtx.role, 'manage_menu')) return NextResponse.json({ error: 'Not authorized for that business' }, { status: 403 })

  const { action } = await req.json().catch(() => ({}))
  if (!['apply', 'reject'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  const admin = await createAdminClient()

  if (action === 'reject') {
    const { data: updated, error } = await admin.from('group_menu_template_applications')
      .update({ status: 'REJECTED', applied_by: staffCtx.userId, applied_at: new Date().toISOString() })
      .eq('id', params.id).eq('business_id', params.businessId).eq('status', 'PENDING').select().single()
    if (!updated) return NextResponse.json({ error: error?.message ?? 'This proposal is no longer pending.' }, { status: 409 })
    await logAuditEvent(admin, { actorId: staffCtx.userId, action: 'group.template_application_rejected', entityType: 'group_menu_template_applications', entityId: params.id })
    return NextResponse.json(updated)
  }

  try {
    const result = await applyMenuTemplateToBusiness(admin, { applicationId: params.id, businessId: params.businessId, userId: staffCtx.userId })
    await logAuditEvent(admin, { actorId: staffCtx.userId, action: 'group.template_application_applied', entityType: 'group_menu_template_applications', entityId: params.id, newValues: result })
    return NextResponse.json({ ok: true, ...result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Could not apply the template.' }, { status: e.statusCode ?? 500 })
  }
}
