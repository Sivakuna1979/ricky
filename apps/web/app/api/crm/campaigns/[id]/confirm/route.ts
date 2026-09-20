// @ts-nocheck
// I34/I37/I38/I59 — the one place a campaign actually sends, via
// confirmAndSendCampaign() (shared with the scheduled-campaign cron
// evaluator so there is exactly one send implementation). Requires
// send_campaigns (a step up from manage_campaigns, which only drafts) —
// the same separation-of-duties pattern Phase H uses for
// create_expense/approve_expense. The atomic DRAFT/SCHEDULED -> SENDING
// claim inside confirmAndSendCampaign is what makes a double-click or a
// retried request return "already handled" instead of sending twice
// (I86).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { confirmAndSendCampaign } from '@/lib/crm/campaigns'
import { logAuditEvent } from '@/lib/auditLog'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'send_campaigns')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const admin = await createAdminClient()
  const { data: campaign } = await admin.from('campaigns').select('id, status').eq('id', params.id).eq('business_id', ctx.businessId).maybeSingle()
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!['DRAFT', 'SCHEDULED', 'SENDING', 'PARTIALLY_FAILED'].includes(campaign.status)) {
    return NextResponse.json({ error: `This campaign is ${campaign.status.toLowerCase()} and cannot be sent.` }, { status: 409 })
  }

  const result = await confirmAndSendCampaign(admin, ctx.businessId, params.id)
  if (!result) return NextResponse.json({ error: 'This campaign was already confirmed.' }, { status: 409 })

  await logAuditEvent(admin, { actorId: ctx.userId, action: 'crm.campaign_sent', entityType: 'campaigns', entityId: params.id, newValues: result })
  return NextResponse.json(result)
}
