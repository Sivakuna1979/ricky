// @ts-nocheck
// L44 — manual retry for a FAILED/NEEDS_REVIEW job. Re-queues it
// immediately (next_retry_at = now) rather than waiting for the next
// backoff window, and resets attempts so a fixed mapping/reconnect gets a
// full fresh set of retries rather than immediately hitting the ceiling
// again.
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { logAuditEvent } from '@/lib/auditLog'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_accounting_integrations')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: job } = await admin.from('accounting_sync_jobs').select('id, business_id, status').eq('id', params.id).maybeSingle()
  if (!job || job.business_id !== ctx.businessId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!['FAILED', 'NEEDS_REVIEW'].includes(job.status)) return NextResponse.json({ error: `Cannot retry a job that is ${job.status}` }, { status: 409 })

  await admin.from('accounting_sync_jobs').update({ status: 'QUEUED', attempts: 0, next_retry_at: new Date().toISOString(), last_error: null }).eq('id', job.id)
  await logAuditEvent(admin, { actorId: ctx.userId, action: 'integrations.sync_job_retried', entityType: 'accounting_sync_jobs', entityId: job.id })

  return NextResponse.json({ ok: true })
}
