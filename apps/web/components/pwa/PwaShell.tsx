// @ts-nocheck
'use client'
// Phase J — mounted once in the root layout (app/layout.tsx), which is
// shared by every route including the business dashboard and admin. This
// component is the single gate that keeps PWA behaviour customer-only
// (J3): it registers the service worker and offers the install prompt
// ONLY on customer-facing paths, and does nothing at all on /dashboard or
// /admin. The service worker itself (public/sw.js) additionally refuses
// to ever cache those paths even if it were somehow active there — this
// component is the first line of defence, not the only one.
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const EXCLUDED_PREFIXES = ['/dashboard', '/admin', '/business']
const DISMISS_KEY = 'ft_install_dismissed_at'
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000 // 14 days — J6 "do not repeatedly nag"

function isCustomerPath(pathname: string) {
  return !EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

async function track(eventType: string) {
  try {
    await fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: eventType }),
      keepalive: true,
    })
  } catch {}
}

export default function PwaShell() {
  const pathname = usePathname() || '/'
  const customerPath = isCustomerPath(pathname)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [show, setShow] = useState(false)

  // Register (or, on a dashboard/admin path, explicitly do NOT register).
  useEffect(() => {
    if (!customerPath) return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
  }, [customerPath])

  // Tasteful install prompt: only on customer pages, only once the browser
  // says it's actually installable, never if already installed, never if
  // dismissed within the last 14 days.
  useEffect(() => {
    if (!customerPath) return
    if (typeof window === 'undefined') return
    const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || (window.navigator as any).standalone
    if (standalone) return

    const lastDismissed = Number(localStorage.getItem(DISMISS_KEY) || 0)
    if (lastDismissed && Date.now() - lastDismissed < DISMISS_COOLDOWN_MS) return

    const onPrompt = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
      track('install_prompt_shown')
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [customerPath])

  if (!customerPath || !show || !deferredPrompt) return null

  const dismiss = (accepted: boolean) => {
    setShow(false)
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    track(accepted ? 'install_prompt_accepted' : 'install_prompt_dismissed')
  }

  const install = async () => {
    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      dismiss(outcome === 'accepted')
    } catch {
      dismiss(false)
    } finally {
      setDeferredPrompt(null)
    }
  }

  return (
    <div role="dialog" aria-label="Install FoodTaxi"
      style={{ position: 'fixed', left: 16, right: 16, bottom: 16, zIndex: 9999, maxWidth: 420, margin: '0 auto', background: '#0d1427', border: '1px solid #1e2a45', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.4)', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif' }}>
      <div style={{ width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(135deg,#f97316,#dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 900 }}>FT</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>Add FoodTaxi to your home screen</div>
        <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>Faster access, no App Store needed</div>
      </div>
      <button onClick={() => dismiss(false)} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 18, cursor: 'pointer', padding: 4 }}>×</button>
      <button onClick={install} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>Install</button>
    </div>
  )
}
