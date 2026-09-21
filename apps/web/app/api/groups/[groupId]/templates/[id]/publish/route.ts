// @ts-nocheck
// M22/M56/M84 — the central change workflow's "propose" step. Publishing
// snapshots the current item list as a new version, then creates a
// PENDING group_menu_template_applications row for every targeted active
// member business (default: all; `business_ids` narrows it) — this alone
// changes NOTHING on any business's live menu. A business must still
// explicitly apply (or reject) via the separate apply/[businessId] route.
// Tracked as a group_bulk_operations row (M78) so the publish itself is
// idempotent and its per-business fan-out is auditable.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveGroupContext } from '@/lib/groups/context'
import { hasGroupPermission } from '@/lib/groups/permissions'
import { logAuditEvent } from '@/lib/auditLog'

// Body: { business_ids? } — omit for "all active member businesses"
export async function POST(req: NextRequest, { params }: { params: { groupId: string; id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await resolveGroupContext(supabase, user.id, params.groupId)
  if (!ctx || !hasGroupPermission(ctx.role, 'manage_group_templates')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: template } = await admin.from('group_menu_templates').select('*').eq('id', params.id).eq('group_id', ctx.groupId).maybeSingle()
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: items } = await admin.from('group_menu_template_items').select('*').eq('template_id', params.id)
  if (!items?.length) return NextResponse.json({ error: 'Add at least one item before publishing.' }, { status: 400 })

  const { data: lastVersion } = await admin.from('group_menu_template_versions').select('version_number').eq('template_id', params.id).order('version_number', { ascending: false }).limit(1).maybeSingle()
  const versionNumber = (lastVersion?.version_number ?? 0) + 1
  const idempotencyKey = `APPLY_MENU_TEMPLATE:${params.id}:v${versionNumber}`

  const { data: existingOp } = await admin.from('group_bulk_operations').select('id').eq('idempotency_key', idempotencyKey).maybeSingle()
  if (existingOp) return NextResponse.json({ error: 'This version has already been published.' }, { status: 409 })

  const { data: version, error: versionErr } = await admin.from('group_menu_template_versions').insert({
    template_id: params.id, version_number: versionNumber, snapshot: items, published_by: ctx.userId,
  }).select().single()
  if (versionErr) return NextResponse.json({ error: versionErr.message }, { status: 500 })

  await admin.from('group_menu_templates').update({ status: 'PUBLISHED', updated_at: new Date().toISOString() }).eq('id', params.id)

  const body = await req.json().catch(() => ({}))
  let targetBusinessIds: string[] = body.business_ids
  if (!targetBusinessIds?.length) {
    const { data: memberships } = await admin.from('group_memberships').select('business_id').eq('group_id', ctx.groupId).eq('status', 'ACTIVE')
    targetBusinessIds = (memberships ?? []).map((m: any) => m.business_id)
  }

  const { data: bulkOp } = await admin.from('group_bulk_operations').insert({
    group_id: ctx.groupId, operation_type: 'APPLY_MENU_TEMPLATE', reference_id: params.id, status: 'RUNNING', initiated_by: ctx.userId, idempotency_key: idempotencyKey,
  }).select().single()

  const results = []
  for (const businessId of targetBusinessIds) {
    const { data: application, error } = await admin.from('group_menu_template_applications').insert({
      template_id: params.id, version_id: version.id, business_id: businessId, proposed_by: ctx.userId,
    }).select('id').single()
    results.push({ operation_id: bulkOp.id, business_id: businessId, status: error ? 'FAILED' : 'SUCCEEDED', reason: error?.message ?? null })
  }
  if (results.length) await admin.from('group_bulk_operation_results').insert(results)
  await admin.from('group_bulk_operations').update({ status: 'COMPLETED', completed_at: new Date().toISOString() }).eq('id', bulkOp.id)

  await logAuditEvent(admin, { actorId: ctx.userId, action: 'group.template_published', entityType: 'group_menu_template_versions', entityId: version.id, newValues: { version_number: versionNumber, target_count: targetBusinessIds.length } })

  return NextResponse.json({ version, proposed_to: targetBusinessIds.length, bulk_operation_id: bulkOp.id }, { status: 201 })
}
