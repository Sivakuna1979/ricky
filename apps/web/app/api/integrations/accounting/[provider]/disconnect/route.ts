// @ts-nocheck
// L27 — disconnect: deletes the stored tokens outright (never just
// "hides" them) and marks the connection DISCONNECTED. Does not touch any
// already-synced job history — past sync_jobs/mappings stay for audit
// purposes, only future syncs stop.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { deleteAccountingTokens } from '@/lib/integrations/secrets'
import { logAuditEvent } from '@/lib/auditLog'

export async function POST(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider?.toUpperCase()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_accounting_integrations')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: connection } = await admin.from('accounting_connections').select('id').eq('business_id', ctx.businessId).eq('provider', provider).maybeSingle()
  if (!connection) return NextResponse.json({ error: 'Not connected' }, { status: 404 })

  await deleteAccountingTokens(admin, connection.id)
  await admin.from('accounting_connections').update({ status: 'DISCONNECTED', disconnected_at: new Date().toISOString(), external_org_id: null, external_org_name: null }).eq('id', connection.id)
  await logAuditEvent(admin, { actorId: ctx.userId, action: 'integrations.accounting_disconnected', entityType: 'accounting_connections', entityId: connection.id })

  return NextResponse.json({ ok: true })
}
