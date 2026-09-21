// @ts-nocheck
'use client'
// L-B — a hook (not a wrapper component) so the POS till's existing JSX
// structure needs no restructuring: `const terminal = useStripeTerminal(...)`
// composes naturally alongside every other piece of till state.
//
// The Stripe Terminal Web SDK is loaded via Stripe's own CDN script tag
// (https://js.stripe.com/terminal/v1/) — Stripe's documented integration
// method for Terminal specifically (distinct from the general
// @stripe/stripe-js npm package already installed but unused elsewhere in
// this repo) — no new npm dependency added.
//
// IMPORTANT CAVEAT: could not be exercised against a real or simulated
// reader in this session (no browser, no network egress to js.stripe.com
// from this sandbox). Written to Stripe's documented Terminal Web SDK API
// (discoverReaders/connectReader/collectPaymentMethod/processPayment) but
// needs a genuine hardware/simulated-reader test pass before production
// use — see docs/FOODTAXI-TECHNICAL-BASELINE.md §72.
import { useEffect, useRef, useState } from 'react'

const SDK_URL = 'https://js.stripe.com/terminal/v1/'

function loadTerminalSdk(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).StripeTerminal) return resolve((window as any).StripeTerminal)
    const existing = document.querySelector(`script[src="${SDK_URL}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).StripeTerminal))
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.onload = () => resolve((window as any).StripeTerminal)
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export type TerminalStatus = 'idle' | 'loading' | 'connecting' | 'connected' | 'unavailable' | 'error'

export function useStripeTerminal({ ready, simulated }: { ready: boolean; simulated: boolean }) {
  const [status, setStatus] = useState<TerminalStatus>('idle')
  const terminalRef = useRef<any>(null)

  useEffect(() => {
    if (!ready) { setStatus('unavailable'); return }
    let cancelled = false
    setStatus('loading')

    loadTerminalSdk()
      .then(async (StripeTerminal) => {
        if (cancelled) return
        const terminal = StripeTerminal.create({
          onFetchConnectionToken: async () => {
            const res = await fetch('/api/pos/terminal/connection-token', { method: 'POST' })
            if (!res.ok) throw new Error('Could not get a connection token')
            const { secret } = await res.json()
            return secret
          },
          onUnexpectedReaderDisconnect: () => { if (!cancelled) setStatus('error') },
        })
        terminalRef.current = terminal

        setStatus('connecting')
        const discovery = await terminal.discoverReaders({ simulated })
        if (cancelled) return
        const found = discovery?.discoveredReaders ?? []
        if (!found.length) { setStatus('error'); return }

        const connectResult = await terminal.connectReader(found[0])
        if (cancelled) return
        if (connectResult.error) { setStatus('error'); return }
        setStatus('connected')
      })
      .catch(() => { if (!cancelled) setStatus('error') })

    return () => { cancelled = true }
  }, [ready, simulated])

  const chargeCard = async (payload: any): Promise<{ ok: boolean; orderId?: string; error?: string }> => {
    if (status !== 'connected' || !terminalRef.current) return { ok: false, error: 'Card reader is not connected.' }

    const createRes = await fetch('/api/pos/terminal/charge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const createData = await createRes.json().catch(() => ({}))
    if (!createRes.ok) return { ok: false, error: createData.error ?? 'Could not start the card payment.' }

    const { order_id: orderId, client_secret: clientSecret, provider_transaction_id: transactionId } = createData

    try {
      const collectResult = await terminalRef.current.collectPaymentMethod(clientSecret)
      if (collectResult.error) {
        await fetch(`/api/pos/terminal/${transactionId}/cancel`, { method: 'POST' })
        return { ok: false, error: collectResult.error.message ?? 'Card was not read — payment cancelled.' }
      }

      const processResult = await terminalRef.current.processPayment(collectResult.paymentIntent)
      if (processResult.error) {
        await fetch(`/api/pos/terminal/${transactionId}/cancel`, { method: 'POST' })
        return { ok: false, error: processResult.error.message ?? 'Card was declined.' }
      }

      // Server-side re-verification (never trusts the SDK's own success
      // callback alone) — independently confirmed a second time by the
      // Stripe Connect webhook regardless, whichever arrives first.
      const confirmRes = await fetch(`/api/pos/terminal/${transactionId}/confirm`, { method: 'POST' })
      const confirmData = await confirmRes.json().catch(() => ({}))
      if (confirmData.status !== 'succeeded') return { ok: false, error: 'Payment could not be confirmed.' }

      return { ok: true, orderId }
    } catch (e: any) {
      await fetch(`/api/pos/terminal/${transactionId}/cancel`, { method: 'POST' }).catch(() => {})
      return { ok: false, error: 'The card reader lost connection during the payment.' }
    }
  }

  return { status, chargeCard }
}
