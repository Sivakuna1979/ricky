// @ts-nocheck
// J35-J38 — the one place that actually sends a web push. VAPID keys are
// read from environment variables only (never committed — see J89 in the
// completion report for the exact names and how to generate them).
import webpush from 'web-push'

let configured = false
function ensureConfigured() {
  if (configured) return true
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@thefoodtaxi.com'
  if (!pub || !priv) return false
  webpush.setVapidDetails(subject, pub, priv)
  configured = true
  return true
}

export function pushConfigured() {
  return ensureConfigured()
}

// J38 — idempotent: a UNIQUE(subscription_id, trigger_key) constraint on
// push_deliveries is the actual guard against a scheduler/webhook retry
// sending the same notification twice, mirroring automation_runs'
// trigger_key pattern exactly. This function claims that row FIRST and
// only sends if the claim succeeds, so a concurrent duplicate call never
// double-sends even under a race.
export async function sendPushToSubscription(admin: any, subscription: any, payload: { title: string; body: string; url?: string; tag?: string }, triggerKey: string) {
  if (!ensureConfigured()) return { sent: false, reason: 'vapid_not_configured' }

  const { error: claimError } = await admin.from('push_deliveries').insert({ subscription_id: subscription.id, trigger_key: triggerKey })
  if (claimError) {
    if (claimError.code === '23505') return { sent: false, reason: 'already_sent' }
    return { sent: false, reason: claimError.message }
  }

  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } },
      JSON.stringify(payload)
    )
    await admin.from('push_subscriptions').update({ last_seen_at: new Date().toISOString() }).eq('id', subscription.id)
    return { sent: true }
  } catch (err: any) {
    // J35 — expired/invalid subscription cleanup: a 404/410 means the
    // browser's push service has permanently discarded this subscription.
    if (err?.statusCode === 404 || err?.statusCode === 410) {
      await admin.from('push_subscriptions').update({ disabled_at: new Date().toISOString() }).eq('id', subscription.id)
    }
    return { sent: false, reason: err?.message ?? 'send_failed' }
  }
}

// Sends to every eligible, non-disabled subscription matching a filter,
// respecting the specific preference toggle for this notification type.
export async function sendPushToMany(admin: any, subscriptions: any[], payload: { title: string; body: string; url?: string; tag?: string }, triggerKeyPrefix: string) {
  const results = await Promise.all(
    subscriptions.map((s) => sendPushToSubscription(admin, s, payload, `${triggerKeyPrefix}:${s.id}`))
  )
  return { sentCount: results.filter((r) => r.sent).length, results }
}
