// @ts-nocheck
// J35 — browser-side push subscription helpers. Never called on page
// load automatically anywhere in this app — always behind an explicit
// user tap, with the context of what it's for already visible (J35: "Never
// request notification permission immediately on first page load without
// context").
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function subscribeToPush(opts: { business_id: string; van_id?: string; order_id?: string }) {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' }
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' }

  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'denied' }

  const keyRes = await fetch('/api/push/vapid-public-key')
  if (!keyRes.ok) return { ok: false, reason: 'not_configured' }
  const { publicKey } = await keyRes.json()

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
  }

  const json = sub.toJSON()
  const res = await fetch('/api/push/subscribe', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, ...opts }),
  })
  if (!res.ok) return { ok: false, reason: 'server_error' }
  const prefs = await res.json()
  return { ok: true, endpoint: json.endpoint, prefs }
}

// J34 — a customer explicitly tapping "notify me when this van's live" is
// itself the opt-in for that one notification type, so this both
// subscribes and turns that specific toggle on in one step — everything
// else (marketing etc.) stays at its default-off.
export async function subscribeToVanArrival(business_id: string, van_id: string) {
  const res = await subscribeToPush({ business_id, van_id })
  if (!res.ok) return res
  await fetch('/api/push/preferences', {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: res.endpoint, notify_favourite_van_arrival: true }),
  }).catch(() => {})
  return res
}

export async function unsubscribeFromPush() {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.ready.catch(() => null)
  const sub = await reg?.pushManager.getSubscription().catch(() => null)
  if (!sub) return
  await fetch('/api/push/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {})
  await sub.unsubscribe().catch(() => {})
}

export async function getCurrentPushEndpoint() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.ready.catch(() => null)
  const sub = await reg?.pushManager.getSubscription().catch(() => null)
  return sub?.endpoint ?? null
}
