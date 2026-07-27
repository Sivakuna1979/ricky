// @ts-nocheck
'use client'
import { useEffect, useRef } from 'react'

// Keeps the screen from auto-locking while a "leave this open" page (till,
// kitchen display, customer screen) is on view. The browser force-releases
// the lock whenever the tab is backgrounded, so it's re-acquired every time
// the page becomes visible again — otherwise it'd stay asleep for good
// after the first time someone switches apps and comes back.
export function useWakeLock(enabled = true) {
  const lockRef = useRef<any>(null)

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return

    const acquire = async () => {
      try { lockRef.current = await (navigator as any).wakeLock.request('screen') } catch {}
    }
    acquire()

    const onVisible = () => { if (document.visibilityState === 'visible') acquire() }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      lockRef.current?.release?.().catch(() => {})
      lockRef.current = null
    }
  }, [enabled])
}
