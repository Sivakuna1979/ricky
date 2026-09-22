// @ts-nocheck
// I33–I38 — campaign audience + send. Eligibility is always
// re-determined here at send time (I59: "revalidate eligibility at send
// time") — a segment computed at draft/preview time is never trusted as
// still accurate by confirm time.
import { getCustomerAggregates, computeSegmentMembership } from './segments'
import { sendAutomationEmail } from '@/lib/notify/channels'
import { sendAutomationSms } from '@/lib/notify/channels'
import { sendMarketingWhatsApp, getWhatsAppChannelForBusiness, isWithinWhatsAppSessionWindow } from '@/lib/notify/whatsapp'

// I28/I29 — resolves a segment_definition ({ type: 'lapsed', days: 60 }
// or { type: 'all' } or { type: 'custom', ... }) into the crm_customers
// currently eligible for a given channel. Never lets AI or the frontend
// supply anything beyond this fixed, deterministic shape (I58).
export async function getEligibleAudience(admin: any, businessId: string, channel: string, segmentDefinition: any) {
  const { data: vans } = await admin.from('vans').select('id').eq('business_id', businessId)
  const vanIds = (vans ?? []).map((v: any) => v.id)
  const aggregates = await getCustomerAggregates(admin, businessId, vanIds)

  const prefColumn = channel === 'email' ? 'marketing_email_opt_in' : channel === 'whatsapp' ? 'marketing_whatsapp_opt_in' : 'marketing_sms_opt_in'
  const { data: customers } = await admin.from('crm_customers').select('*').eq('business_id', businessId).eq(prefColumn, true).is('merged_into_id', null)

  let eligible = (customers ?? []).filter((c: any) => {
    if (channel === 'email' && !c.email) return false
    if ((channel === 'whatsapp' || channel === 'sms') && !c.normalized_phone) return false
    return true
  })

  if (segmentDefinition?.type && segmentDefinition.type !== 'all') {
    eligible = eligible.filter((c: any) => computeSegmentMembership(aggregates.get(c.identity_key), segmentDefinition.type, { lapsedDays: segmentDefinition.days, highSpendThreshold: segmentDefinition.threshold }))
  }

  // I32 — the global email suppression list is the absolute floor,
  // checked again here regardless of the per-business preference flag.
  if (channel === 'email') {
    const emails = eligible.map((c: any) => c.email).filter(Boolean)
    const { data: unsubs } = emails.length ? await admin.from('email_unsubscribes').select('email').in('email', emails) : { data: [] }
    const suppressed = new Set((unsubs ?? []).map((u: any) => u.email.toLowerCase()))
    eligible = eligible.filter((c: any) => !suppressed.has(c.email.toLowerCase()))
  }

  return eligible
}

export async function estimateRecipientCount(admin: any, businessId: string, channel: string, segmentDefinition: any) {
  const eligible = await getEligibleAudience(admin, businessId, channel, segmentDefinition)
  return eligible.length
}

// I38 — queues one campaign_recipients row per eligible customer.
// UNIQUE(campaign_id, crm_customer_id) is what makes a retried/duplicate
// call to this function safe — already-queued rows are simply skipped,
// never duplicated.
export async function queueCampaignRecipients(admin: any, businessId: string, campaignId: string, channel: string, segmentDefinition: any) {
  const eligible = await getEligibleAudience(admin, businessId, channel, segmentDefinition)
  const { data: existing } = await admin.from('campaign_recipients').select('crm_customer_id').eq('campaign_id', campaignId)
  const already = new Set((existing ?? []).map((r: any) => r.crm_customer_id))
  const toQueue = eligible.filter((c: any) => !already.has(c.id)).map((c: any) => ({
    campaign_id: campaignId, crm_customer_id: c.id, contact: channel === 'email' ? c.email : c.normalized_phone, status: 'QUEUED',
  }))
  if (toQueue.length) await admin.from('campaign_recipients').insert(toQueue)
  return eligible.length
}

// I35/I38 — actually sends to every still-QUEUED recipient, capped per
// call (SEND_BATCH_LIMIT) so a very large audience doesn't risk a
// serverless timeout in one request; re-calling the confirm endpoint
// processes the next batch (idempotent — already-SENT rows are never
// touched again).
const SEND_BATCH_LIMIT = 500

export async function sendQueuedCampaign(admin: any, businessId: string, campaign: { id: string; channel: string; subject: string | null; message: string }) {
  const { data: recipients } = await admin.from('campaign_recipients').select('*, crm_customers(normalized_phone, email, display_name)').eq('campaign_id', campaign.id).eq('status', 'QUEUED').limit(SEND_BATCH_LIMIT)
  let sent = 0, failed = 0

  let whatsappChannel: any = null
  if (campaign.channel === 'whatsapp') whatsappChannel = await getWhatsAppChannelForBusiness(admin, businessId)

  for (const r of recipients ?? []) {
    let result: { ok: boolean; error?: string } = { ok: false, error: 'unknown' }
    if (campaign.channel === 'email') {
      const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://food-taxi.vercel.app'}/api/marketing/unsubscribe?email=${encodeURIComponent(r.contact)}`
      result = await sendAutomationEmail(r.contact, campaign.subject ?? 'A message from your favourite food van', `<p>${campaign.message.replace(/\n/g, '<br/>')}</p><p style="font-size:11px;color:#888">Don't want these emails? <a href="${unsubscribeUrl}">Unsubscribe</a>.</p>`)
    } else if (campaign.channel === 'sms') {
      result = await sendAutomationSms(r.contact, campaign.message)
    } else if (campaign.channel === 'whatsapp') {
      if (!whatsappChannel) { result = { ok: false, error: 'no_whatsapp_channel' } }
      else if (!(await isWithinWhatsAppSessionWindow(admin, r.contact))) {
        await admin.from('campaign_recipients').update({ status: 'SKIPPED_OUT_OF_WINDOW' }).eq('id', r.id)
        continue
      } else {
        result = await sendMarketingWhatsApp(whatsappChannel, r.contact, campaign.message)
      }
    }

    if (result.ok) {
      sent++
      await admin.from('campaign_recipients').update({ status: 'SENT', sent_at: new Date().toISOString() }).eq('id', r.id)
    } else {
      failed++
      await admin.from('campaign_recipients').update({ status: 'FAILED', error: result.error ?? 'send_failed' }).eq('id', r.id)
    }
  }

  const { count: stillQueued } = await admin.from('campaign_recipients').select('id', { count: 'exact', head: true }).eq('campaign_id', campaign.id).eq('status', 'QUEUED')
  return { sent, failed, still_queued: stillQueued ?? 0 }
}

// I37/I38 — the one place a campaign transitions from DRAFT/SCHEDULED
// into actually sending, shared by the manual "Confirm & Send" API route
// and the scheduled-campaign cron evaluator so there is exactly one
// implementation of the atomic claim + queue + send sequence.
export async function confirmAndSendCampaign(admin: any, businessId: string, campaignId: string) {
  const { data: campaign } = await admin.from('campaigns').select('*').eq('id', campaignId).eq('business_id', businessId).maybeSingle()
  if (!campaign) return null

  if (['DRAFT', 'SCHEDULED'].includes(campaign.status)) {
    const { data: claimed } = await admin.from('campaigns').update({ status: 'SENDING' }).eq('id', campaignId).in('status', ['DRAFT', 'SCHEDULED']).select('id').maybeSingle()
    if (!claimed) return null // already claimed by a concurrent call
    await queueCampaignRecipients(admin, businessId, campaignId, campaign.channel, campaign.segment_definition)
  } else if (!['SENDING', 'PARTIALLY_FAILED'].includes(campaign.status)) {
    return null
  }

  const result = await sendQueuedCampaign(admin, businessId, campaign)
  const finalStatus = result.still_queued > 0 ? 'SENDING' : result.failed > 0 && result.sent === 0 ? 'FAILED' : result.failed > 0 ? 'PARTIALLY_FAILED' : 'SENT'
  await admin.from('campaigns').update({ status: finalStatus, sent_at: finalStatus !== 'SENDING' ? new Date().toISOString() : undefined }).eq('id', campaignId)
  return { status: finalStatus, ...result }
}
