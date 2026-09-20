// @ts-nocheck
'use client'

import { useState } from 'react'

async function goTo(endpoint: string, setLoading: (v: boolean) => void, setError: (v: string) => void) {
  setLoading(true)
  setError('')
  try {
    const res = await fetch(endpoint, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Something went wrong'); setLoading(false); return }
    window.location.href = data.url
  } catch {
    setError('Network error — please try again')
    setLoading(false)
  }
}

export function StartSubscriptionButton({ label = 'Start Free Trial' }: { label?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  return (
    <div>
      <button
        onClick={() => goTo('/api/subscriptions/checkout', setLoading, setError)}
        disabled={loading}
        style={{ display:'inline-block', padding:'12px 24px', borderRadius:10, background:'#fff', color:'#f97316', fontWeight:800, fontSize:14, border:'none', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
      >
        {loading ? 'Redirecting…' : `${label} →`}
      </button>
      {error && <div style={{ color:'#fecaca', fontSize:12, marginTop:8 }}>{error}</div>}
    </div>
  )
}

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  return (
    <div>
      <button
        onClick={() => goTo('/api/subscriptions/portal', setLoading, setError)}
        disabled={loading}
        style={{ display:'inline-block', padding:'10px 20px', borderRadius:10, background:'#f5f6fa', border:'1px solid #e5e7eb', color:'#374151', fontWeight:600, fontSize:13, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
      >
        {loading ? 'Opening…' : 'Manage Subscription →'}
      </button>
      {error && <div style={{ color:'#dc2626', fontSize:12, marginTop:8 }}>{error}</div>}
    </div>
  )
}
