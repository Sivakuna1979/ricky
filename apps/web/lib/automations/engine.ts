// @ts-nocheck
// The automation engine core (D1, D3, D4). Every evaluator in
// lib/automations/evaluators/* follows the same three-step shape:
//
//   1. claimRun()  — attempts to INSERT the automation_runs row for this
//      exact trigger_key. If another process (a retried cron tick, an
//      overlapping invocation) already claimed it, this returns null and
//      the evaluator does nothing further — this IS the idempotency
//      guarantee (D4), enforced by the database's UNIQUE constraint, not
//      by application-level "check then act" logic which would have a
//      race window.
//   2. notify()    — creates the in-app notification (always, if the
//      automation's `in_app` channel is on) and fans out to email/SMS only
//      if the business has explicitly enabled those channels for this
//      automation type (D7) — external messages are never sent by default.
//   3. completeRun() — marks the run COMPLETED or FAILED with a result/
//      reason, closing the audit trail (D3).
import { getResolvedSettings } from './settings'
import { sendAutomationEmail, sendAutomationSms } from '@/lib/notify/channels'
import type { AutomationType } from './types'

// Claims exclusive right to execute this exact trigger_key. A fresh key
// always succeeds. A key that already COMPLETED/is PENDING/RUNNING/was
// SKIPPED stays claimed (returns null — this is the D4 dedup guarantee). A
// key whose only previous attempt FAILED can be reclaimed — this is what
// makes a manual retry (D31) or the next scheduled tick after a transient
// failure actually able to try again, rather than being permanently
// blocked by its own failed history.
export async function claimRun(admin: any, businessId: string, automationType: AutomationType, triggerKey: string): Promise<string | null> {
  const { data: inserted, error } = await admin
    .from('automation_runs')
    .insert({ business_id: businessId, automation_type: automationType, trigger_key: triggerKey, status: 'RUNNING' })
    .select('id')
    .single()
  if (!error) return inserted.id

  const { data: reclaimed } = await admin
    .from('automation_runs')
    .update({ status: 'RUNNING', failure_reason: null })
    .eq('business_id', businessId).eq('trigger_key', triggerKey).eq('status', 'FAILED')
    .select('id')
    .maybeSingle()
  return reclaimed?.id ?? null
}

export async function completeRun(admin: any, runId: string, params: { status: 'COMPLETED' | 'FAILED' | 'SKIPPED'; actionTaken?: string; result?: any; failureReason?: string }) {
  await admin.from('automation_runs').update({
    status: params.status, action_taken: params.actionTaken ?? null, result: params.result ?? null, failure_reason: params.failureReason ?? null,
  }).eq('id', runId)
}

export type NotifyParams = {
  businessId: string
  automationType: AutomationType
  recipients: { user_id: string; email: string | null; phone: string | null }[]
  title: string
  body: string
  category: string
  priority: 'INFO' | 'ACTION' | 'IMPORTANT' | 'CRITICAL'
  actionUrl?: string
}

export async function notify(admin: any, params: NotifyParams) {
  const settings = (await getResolvedSettings(admin, params.businessId))[params.automationType]
  const channels = settings.channels

  if (channels.in_app) {
    const rows = params.recipients.map(r => ({
      user_id: r.user_id,
      title: params.title,
      body: params.body,
      type: params.automationType,
      data: { business_id: params.businessId, category: params.category, priority: params.priority, action_url: params.actionUrl ?? null },
    }))
    if (rows.length) await admin.from('notifications').insert(rows)
  }

  const deliveries: Record<string, any> = {}
  if (channels.email) {
    for (const r of params.recipients) {
      if (!r.email) continue
      deliveries[`email:${r.email}`] = await sendAutomationEmail(r.email, params.title, `<p>${params.body}</p>`)
    }
  }
  if (channels.sms) {
    for (const r of params.recipients) {
      if (!r.phone) continue
      deliveries[`sms:${r.phone}`] = await sendAutomationSms(r.phone, `${params.title}: ${params.body}`)
    }
  }

  return { in_app: channels.in_app, recipientCount: params.recipients.length, deliveries }
}
