// @ts-nocheck
'use client'
// L25/L26/L28 — the Integration Centre. Shows CONNECTED/ACTION_REQUIRED/
// ERROR/DISCONNECTED for every payment/accounting connection, never a
// secret value (the API this reads from only ever selects the non-secret
// *_connections tables). Payment-provider "Connect" is intentionally NOT
// wired to a real OAuth flow here — no provider has been approved yet
// (see the Phase L decision report) — it explains why instead.
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
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    fetch('/api/integrations/status').then(r => r.json()).then(setStatus).catch(() => {})
    fetch('/api/integrations/accounting/sync-jobs').then(r => r.json()).then(setSyncJobs).catch(() => {})
    fetch('/api/integrations/review-queue').then(r => r.json()).then(setReviewQueue).catch(() => {})
    fetch('/api/integrations/accounting/mappings').then(r => r.json()).then(setMappings).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const disconnect = async (provider: string) => {
    setBusy(provider)
    await fetch(`/api/integrations/accounting/${provider.toLowerCase()}/disconnect`, { method: 'POST' })
    setBusy(null); load()
  }
  const retryJob = async (id: string) => { await fetch(`/api/integrations/accounting/sync-jobs/${id}/retry`, { method: 'POST' }); load() }
  const handleReviewItem = async (id: string, action: string) => { await fetch(`/api/integrations/review-queue/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }); load() }
  const reconcileNow = async () => { setBusy('reconcile'); await fetch('/api/integrations/reconcile', { method: 'POST' }); setBusy(null); load() }

  if (!status) return <div style={{ color: '#6b7280' }}>Loading…</div>

  const accountingByProvider = Object.fromEntries((status.accounting.connections ?? []).map((c: any) => [c.provider, c]))

  return (
    <div>
      <Card title="Customer card payments" subtitle="No live payment provider processes real card payments today — POS and online orders still record cash/card as staff-entered labels, exactly as before.">
        <div style={{ fontSize: 13, color: '#374151', marginBottom: 12, padding: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8 }}>
          Live card processing is not active for any business yet. The owner reviewed a provider decision report (Stripe Terminal, SumUp, Square, Zettle, Dojo) and a specific provider has not been approved. Nothing here can be connected until that happens.
        </div>
        {Object.entries(status.payment_providers.candidates).filter(([k]) => k !== 'OTHER').map(([key, info]: any) => (
          <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
            <div><b>{info.label}</b><div style={{ color: '#6b7280', fontSize: 12 }}>{info.notes}</div></div>
            <Badge status="DISCONNECTED" />
          </div>
        ))}
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
