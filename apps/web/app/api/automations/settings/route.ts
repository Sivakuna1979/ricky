// @ts-nocheck
// Automation control centre settings (D26, D27). Read is available to any
// staff role so they can see what's on; changing settings requires
// manage_business (owner/business_admin only — D36 explicitly says
// ordinary staff shouldn't change global automation settings).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { getResolvedSettings } from '@/lib/automations/settings'
import { AUTOMATIONS, AUTOMATION_TYPE_LIST } from '@/lib/automations/types'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx) return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })

  const admin = await createAdminClient()
  const resolved = await getResolvedSettings(admin, ctx.businessId)
  const list = AUTOMATION_TYPE_LIST.map(type => ({ ...resolved[type], ...AUTOMATIONS[type] }))
  return NextResponse.json(list)
}

// Body: { automation_type, enabled?, channels?, config? }
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_business')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  if (!AUTOMATION_TYPE_LIST.includes(body.automation_type)) return NextResponse.json({ error: 'Unknown automation_type' }, { status: 400 })

  const admin = await createAdminClient()
  const { data: existing } = await admin.from('automation_settings').select('*').eq('business_id', ctx.businessId).eq('automation_type', body.automation_type).maybeSingle()

  const def = AUTOMATIONS[body.automation_type]
  const update = {
    business_id: ctx.businessId,
    automation_type: body.automation_type,
    enabled: body.enabled ?? existing?.enabled ?? def.defaultEnabled,
    channels: body.channels ?? existing?.channels ?? def.defaultChannels,
    config: body.config ?? existing?.config ?? {},
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await admin.from('automation_settings').upsert(update, { onConflict: 'business_id,automation_type' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent(admin, {
    actorId: ctx.userId, action: 'automation.settings_changed', entityType: 'automation_settings', entityId: data.id,
    oldValues: existing, newValues: update,
  })

  return NextResponse.json(data)
}
