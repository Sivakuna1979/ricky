// @ts-nocheck
'use client'
// L25/L26/L28 — the Integration Centre. Shows CONNECTED/ACTION_REQUIRED/
// ERROR/DISCONNECTED for every payment/accounting connection, never a
// secret value (the API this reads from only ever selects the non-secret
// *_connections tables). L-B — Stripe Terminal now has a real Connect
// button (Express onboarding) since the owner explicitly approved it; the
// other researched candidates (SumUp/Square/Zettle/Dojo) stay informational
// only — no OAuth was ever built for an unapproved provider.
import { useEffect, useState } from 'react'

const STATUS_COLOR: Record<string, string> = { CONNECTED: '#059669', ACTION_REQUIRED: '#d97706', ERROR: '#dc2626', DISCONNECTED: '#6b7280' }

function Badge({ status }: { status: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: '#fff', background: STATUS_COLOR[status] ?? '#6b7280' }}>{status.replace('_', ' ')}</span>
}

function Card({ title, subtitle, children }: any) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, margin: '0 0 4px' }}>{title}</h2>
      {subtitle && <div style={{ color: '#6b7280', fontSize: 12, marginBottom: 14 }}>{subtitle}</div>}
      {children}
    </div>
  )
}

export function IntegrationCentre() {
  const [status, setStatus] = useState<any>(null)
  const [mappings, setMappings] = useState<any[]>([])
  const [syncJobs, setSyncJobs] = useState<any[]>([])
  const [reviewQueue, setReviewQueue] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [locationForm, setLocationForm] = useState<any>({ van_id: '', line1: '', city: '', postal_code: '' })
  const [refundState, setRefundState] = useState<Record<string, { amount: string; reason: string; refundId?: string }>>({})

  const load = () => {
    fetch('/api/integrations/status').then(r => r.json()).then(setStatus).catch(() => {})
    fetch('/api/integrations/accounting/sync-jobs').then(r => r.json()).then(setSyncJobs).catch(() => {})
    fetch('/api/integrations/review-queue').then(r => r.json()).then(setReviewQueue).catch(() => {})
    fetch('/api/integrations/accounting/mappings').then(r => r.json()).then(setMappings).catch(() => {})
    fetch('/api/integrations/payments/transactions').then(r => r.json()).then(d => setTransactions(Array.isArray(d) ? d : [])).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const disconnect = async (provider: string) => {
    setBusy(provider)
    await fetch(`/api/integrations/accounting/${provider.toLowerCase()}/disconnect`, { method: 'POST' })
    setBusy(null); load()
  }
  const disconnectStripeTerminal = async () => {
    setBusy('STRIPE_TERMINAL')
    await fetch('/api/integrations/payments/stripe-terminal/disconnect', { method: 'POST' })
    setBusy(null); load()
  }
  const addLocation = async () => {
    setBusy('add-location')
    const res = await fetch('/api/integrations/payments/stripe-terminal/locations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(locationForm) })
    setBusy(null)
    if (res.ok) { setLocationForm({ van_id: '', line1: '', city: '', postal_code: '' }); load() }
  }
  const retryJob = async (id: string) => { await fetch(`/api/integrations/accounting/sync-jobs/${id}/retry`, { method: 'POST' }); load() }
  const handleReviewItem = async (id: string, action: string) => { await fetch(`/api/integrations/review-queue/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }); load() }
  const reconcileNow = async () => { setBusy('reconcile'); await fetch('/api/integrations/reconcile', { method: 'POST' }); setBusy(null); load() }

  const requestRefund = async (txnId: string) => {
    const r = refundState[txnId]
    if (!r?.amount || !r?.reason) return
    setBusy(`refund-${txnId}`)
    const res = await fetch(`/api/integrations/payments/transactions/${txnId}/refund`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(r.amount), reason: r.reason }) })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (res.ok) setRefundState(s => ({ ...s, [txnId]: { ...s[txnId], refundId: data.refund_id } }))
  }
  const confirmRefund = async (txnId: string) => {
    const refundId = refundState[txnId]?.refundId
    if (!refundId) return
    setBusy(`confirm-${txnId}`)
    await fetch(`/api/integrations/payments/refunds/${refundId}/confirm`, { method: 'POST' })
    setBusy(null)
    setRefundState(s => { const next = { ...s }; delete next[txnId]; return next })
    load()
  }

  if (!status) return <div style={{ color: '#6b7280' }}>Loading…</div>

  const accountingByProvider = Object.fromEntries((status.accounting.connections ?? []).map((c: any) => [c.provider, c]))
  const stripeConnection = (status.payment_providers.connections ?? []).find((c: any) => c.provider === 'STRIPE_TERMINAL')
  const stripeConnected = stripeConnection?.status === 'CONNECTED'

  return (
    <div>
      <Card title="Customer card payments — Stripe Terminal" subtitle="Approved by the owner after reviewing the provider decision report. No FoodTaxi commission is taken — the full charge (minus Stripe's own processing fee) goes to the business's own account.">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
          <div>
            <b>Stripe Terminal</b>
            {stripeConnection?.last_error && <div style={{ fontSize: 12, color: '#dc2626' }}>{stripeConnection.last_error}</div>}
            {!stripeConnection && <div style={{ fontSize: 12, color: '#6b7280' }}>Not connected yet — connect to start taking real card payments at the till.</div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Badge status={stripeConnection?.status ?? 'DISCONNECTED'} />
            {stripeConnected
              ? <button disabled={busy === 'STRIPE_TERMINAL'} onClick={disconnectStripeTerminal} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>Disconnect</button>
              : <a href="/api/integrations/payments/stripe-terminal/onboard" style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: '#635bff', color: '#fff', textDecoration: 'none', fontWeight: 700 }}>Connect with Stripe</a>}
          </div>
        </div>

        {stripeConnected && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>Terminal locations (one per van)</div>
            {(status.terminals ?? []).filter((t: any) => t.provider === 'STRIPE_TERMINAL').map((t: any) => (
              <div key={t.id} style={{ fontSize: 12, color: '#6b7280', padding: '3px 0' }}>{t.label} — <Badge status={t.status === 'ACTIVE' ? 'CONNECTED' : 'DISCONNECTED'} /></div>
            ))}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              <select value={locationForm.van_id} onChange={e => setLocationForm({ ...locationForm, van_id: e.target.value })} style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                <option value="">Van…</option>
                {(status.vans ?? []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <input placeholder="Address line 1" value={locationForm.line1} onChange={e => setLocationForm({ ...locationForm, line1: e.target.value })} style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb', width: 140 }} />
              <input placeholder="City" value={locationForm.city} onChange={e => setLocationForm({ ...locationForm, city: e.target.value })} style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb', width: 100 }} />
              <input placeholder="Postcode" value={locationForm.postal_code} onChange={e => setLocationForm({ ...locationForm, postal_code: e.target.value })} style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb', width: 90 }} />
              <button onClick={addLocation} disabled={busy === 'add-location' || !locationForm.van_id || !locationForm.line1} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: 'none', background: '#111827', color: '#fff', cursor: 'pointer' }}>Add location</button>
            </div>
          </div>
        )}

        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', margin: '16px 0 8px' }}>Recent card transactions</div>
        {transactions.length === 0 ? <div style={{ fontSize: 13, color: '#6b7280' }}>No card transactions yet.</div> : transactions.slice(0, 15).map((t: any) => (
          <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>{t.provider} · £{Number(t.amount).toFixed(2)} · {new Date(t.created_at).toLocaleString('en-GB')}</div>
              <Badge status={t.status === 'SUCCEEDED' ? 'CONNECTED' : ['FAILED', 'CANCELLED'].includes(t.status) ? 'ERROR' : 'ACTION_REQUIRED'} />
            </div>
            {['SUCCEEDED', 'PARTIALLY_REFUNDED'].includes(t.status) && (
              <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {!refundState[t.id]?.refundId ? (
                  <>
                    <input placeholder="Refund £" value={refundState[t.id]?.amount ?? ''} onChange={e => setRefundState(s => ({ ...s, [t.id]: { ...s[t.id], amount: e.target.value } }))} style={{ width: 70, fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                    <input placeholder="Reason" value={refundState[t.id]?.reason ?? ''} onChange={e => setRefundState(s => ({ ...s, [t.id]: { ...s[t.id], reason: e.target.value } }))} style={{ width: 140, fontSize: 11, padding: '4px 6px', borderRadius: 6, border: '1px solid #e5e7eb' }} />
                    <button onClick={() => requestRefund(t.id)} disabled={busy === `refund-${t.id}`} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>Request refund</button>
                  </>
                ) : (
                  <>
                    <span style={{ color: '#92400e', fontWeight: 700 }}>Refund requested — confirm to actually issue it via Stripe:</span>
                    <button onClick={() => confirmRefund(t.id)} disabled={busy === `confirm-${t.id}`} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer' }}>Confirm refund</button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}

        <div style={{ marginTop: 14, fontSize: 12, color: '#6b7280' }}>
          Other researched candidates (informational only — not connectable): {Object.entries(status.payment_providers.candidates).filter(([k]: any) => k !== 'OTHER' && k !== 'STRIPE_TERMINAL').map(([, info]: any) => info.label).join(', ')}.
        </div>
      </Card>

      <Card title="Accounting" subtitle="Xero and QuickBooks — conservative summary sync, never individual orders. Mappings are labels, not tax advice.">
        {['XERO', 'QUICKBOOKS'].map((provider) => {
          const conn = accountingByProvider[provider]
          return (
            <div key={provider} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div>
                <b>{provider === 'XERO' ? 'Xero' : 'QuickBooks'}</b>
                {conn?.external_org_name && <div style={{ fontSize: 12, color: '#6b7280' }}>{conn.external_org_name}</div>}
                {conn?.last_error && <div style={{ fontSize: 12, color: '#dc2626' }}>{conn.last_error}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Badge status={conn?.status ?? 'DISCONNECTED'} />
                {conn?.status === 'CONNECTED'
                  ? <button disabled={busy === provider} onClick={() => disconnect(provider)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>Disconnect</button>
                  : <a href={`/api/integrations/accounting/${provider.toLowerCase()}/authorize`} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: '#111827', color: '#fff', textDecoration: 'none' }}>Connect</a>}
              </div>
            </div>
          )
        })}
        {mappings.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Account mappings</div>
            {mappings.map((m: any) => (
              <div key={m.id} style={{ fontSize: 12, color: '#6b7280', padding: '3px 0' }}>{m.provider} · {m.category} → {m.external_account_name ?? m.external_account_id}{m.tax_code ? ` (tax: ${m.tax_code})` : ''}</div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Sync jobs" subtitle="Background queue pushing summaries to accounting. Failed jobs retry automatically with backoff; jobs stuck after 5 attempts need review.">
        {syncJobs.length === 0 ? <div style={{ fontSize: 13, color: '#6b7280' }}>No sync activity yet.</div> : syncJobs.slice(0, 15).map((j: any) => (
          <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
            <div>{j.provider} · {j.job_type} {j.last_error && <span style={{ color: '#dc2626' }}> — {j.last_error}</span>}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Badge status={j.status === 'SYNCED' ? 'CONNECTED' : j.status === 'NEEDS_REVIEW' ? 'ERROR' : j.status === 'FAILED' ? 'ACTION_REQUIRED' : 'DISCONNECTED'} />
              {['FAILED', 'NEEDS_REVIEW'].includes(j.status) && <button onClick={() => retryJob(j.id)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>Retry</button>}
            </div>
          </div>
        ))}
      </Card>

      <Card title="Reconciliation review queue" subtitle="Deterministic matching only — nothing here is auto-resolved or AI-guessed.">
        <button onClick={reconcileNow} disabled={busy === 'reconcile'} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f5f6fa', cursor: 'pointer', marginBottom: 10 }}>Re-check reconciliation</button>
        {reviewQueue.length === 0 ? <div style={{ fontSize: 13, color: '#6b7280' }}>Nothing open.</div> : reviewQueue.map((item: any) => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 12 }}>
            <div><b>{item.category.replace(/_/g, ' ')}</b><div style={{ color: '#6b7280' }}>{item.detail}</div></div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => handleReviewItem(item.id, 'resolve')} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>Resolve</button>
              <button onClick={() => handleReviewItem(item.id, 'dismiss')} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer' }}>Dismiss</button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}
