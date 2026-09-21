// FoodTaxi PWA service worker.
//
// J3/J4 SAFETY DESIGN — read before changing this file:
//   - Only ever registered from customer-facing pages (see
//     components/pwa/PwaRegister.tsx), never from /dashboard or /admin.
//   - Even so, this file defends itself: it NEVER intercepts /dashboard,
//     /admin, or ANY /api/ request, and it NEVER intercepts a non-GET
//     request. Prices, stock, order totals, loyalty balances, promo
//     eligibility, route status and all financial data flow exclusively
//     through /api/* and are therefore always fetched live, never served
//     from a cache by this worker.
//   - The only things ever cached are: (1) the static offline fallback
//     page, the manifest and icons, and (2) Next.js's own content-hashed
//     immutable /_next/static/* build assets, which are safe to cache
//     because a new deploy always ships new hashed filenames (cache-first
//     for these can never serve stale application code).
//   - No HTML page is ever cached, so a customer can never be shown a
//     stale menu/price/status page while appearing "online".

const VERSION = 'foodtaxi-pwa-v1'
const STATIC_CACHE = `${VERSION}-static`

const PRECACHE_URLS = [
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('foodtaxi-pwa-') && k !== STATIC_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

function isNeverCachePath(pathname) {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/business') // legacy alias, same rule
  )
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return // never touch writes — server stays authoritative

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (isNeverCachePath(url.pathname)) return // let the network handle it, always

  // Next.js immutable build assets — safe cache-first, new deploys use new hashes.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req)
        if (cached) return cached
        try {
          const res = await fetch(req)
          if (res.ok) cache.put(req, res.clone())
          return res
        } catch {
          return cached || Response.error()
        }
      })
    )
    return
  }

  // Page navigations: always go to the network (never serve a cached page —
  // menus/prices/order status must always be live) and only fall back to
  // the static offline page if the network is genuinely unreachable.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/offline.html'))
    )
    return
  }

  // Everything else (icons, manifest, fonts): cache-first with network fallback.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).catch(() => cached))
  )
})

// J35 — web push delivery. The payload is always a small JSON object the
// server controls (lib/push/send.ts); nothing here trusts client input.
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try { payload = event.data.json() } catch { return }
  const { title, body, url, tag, icon } = payload || {}
  if (!title) return
  event.waitUntil(
    self.registration.showNotification(title, {
      body: body || '',
      icon: icon || '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: tag || undefined,
      data: { url: url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification?.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === target && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })
  )
})

// J35 — expired/rotated subscription cleanup: tell the server so it can
// mark the row disabled, rather than silently failing forever server-side.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    fetch('/api/push/resubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldEndpoint: event.oldSubscription?.endpoint || null }),
    }).catch(() => {})
  )
})
