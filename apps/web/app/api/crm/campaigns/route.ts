// @ts-nocheck
// I34/I36 — campaigns. Extends (never replaces) the existing
// /api/marketing/send — that stays exactly as-is for a simple untargeted
// blast; this is the segmented/scheduled/multi-channel engine with real
// per-recipient delivery tracking.
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { estimateRecipientCount } from '@/lib/crm/campaigns'
import { logAuditEvent } from '@/lib/auditLog'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_campaigns')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: campaigns } = await admin.from('campaigns').select('*').eq('business_id', ctx.businessId).order('created_at', { ascending: false }).limit(100)
  const ids = (campaigns ?? []).map((c: any) => c.id)
  const { data: recipients } = ids.length ? await admin.from('campaign_recipients').select('campaign_id, status').in('campaign_id', ids) : { data: [] }
  const statsByCampaign: Record<string, Record<string, number>> = {}
  for (const r of recipients ?? []) {
    statsByCampaign[r.campaign_id] ??= {}
    statsByCampaign[r.campaign_id][r.status] = (statsByCampaign[r.campaign_id][r.status] ?? 0) + 1
  }
  return NextResponse.json((campaigns ?? []).map((c: any) => ({ ...c, delivery_stats: statsByCampaign[c.id] ?? {} })))
}

// Body: { name, channel, segment_definition, subject?, message, campaign_type?, scheduled_for? }
// Creates a DRAFT only — nothing is sent here (I34: draft -> preview ->
// confirm -> send). Preview (estimated_recipients) is computed
// immediately so the UI can show it before the user even saves.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'manage_campaigns')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const { name, channel, segment_definition, subject, message, campaign_type, scheduled_for } = body
  if (!name?.trim() || !channel || !message?.trim()) return NextResponse.json({ error: 'name, channel and message are required' }, { status: 400 })
  if (!['email', 'whatsapp', 'sms'].includes(channel)) return NextResponse.json({ error: 'Invalid channel' }, { status: 400 })
  if (channel === 'email' && !subject?.trim()) return NextResponse.json({ error: 'Email campaigns need a subject' }, { status: 400 })

  const admin = await createAdminClient()
  const estimatedRecipients = await estimateRecipientCount(admin, ctx.businessId, channel, segment_definition ?? { type: 'all' })

  const { data: campaign, error } = await admin.from('campaigns').insert({
    business_id: ctx.businessId, name: name.trim(), channel, segment_definition: segment_definition ?? { type: 'all' },
    subject: subject?.trim() ?? null, message: message.trim(), status: scheduled_for ? 'SCHEDULED' : 'DRAFT',
    scheduled_for: scheduled_for ?? null, campaign_type: campaign_type ?? 'general', estimated_recipients: estimatedRecipients, created_by: ctx.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditEvent(admin, { actorId: ctx.userId, action: scheduled_for ? 'crm.campaign_scheduled' : 'crm.campaign_created', entityType: 'campaigns', entityId: campaign.id, newValues: campaign })
  return NextResponse.json(campaign, { status: 201 })
}
