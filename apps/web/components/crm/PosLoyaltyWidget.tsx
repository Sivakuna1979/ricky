// @ts-nocheck
'use client'
// I17 — POS loyalty: find customer, see balance/reward, redeem. Applying
// a redeemed voucher or a promo code to THIS sale is done by typing its
// code into the till's own discount-code field (wired in the POS page) —
// server-side validation happens at sale completion, never here.
import { useState } from 'react'

const input = { padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }
const btn = { padding: '7px 12px', borderRadius: 8, border: 'none', background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }

export function PosLoyaltyWidget({ onVoucherIssued }: { onVoucherIssued?: (code: string) => void }) {
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [redeeming, setRedeeming] = useState(false)

  const lookup = async () => {
    setError(''); setResult(null)
    const res = await fetch(`/api/crm/loyalty/account?phone=${encodeURIComponent(phone)}`)
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Loyalty is not enabled'); return }
    setResult(data)
  }
  const redeem = async () => {
    setRedeeming(true)
    const res = await fetch('/api/crm/loyalty/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ crm_customer_id: result.crm_customer_id }) })
    const data = await res.json()
    setRedeeming(false)
    if (!res.ok) { setError(data.error); return }
    onVoucherIssued?.(data.voucher.code)
    lookup()
  }

  if (!open) return <button onClick={() => setOpen(true)} style={{ ...btn, background: '#f5f6fa', color: '#7c3aed', border: '1px solid #e5e7eb', marginBottom: 10 }}>🏆 Loyalty lookup</button>

  return (
    <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: 10, marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input placeholder="Customer phone" value={phone} onChange={e => setPhone(e.target.value)} style={{ ...input, flex: 1 }} />
        <button onClick={lookup} style={btn}>Look up</button>
        <button onClick={() => setOpen(false)} style={{ ...btn, background: 'none', color: '#888' }}>✕</button>
      </div>
      {error && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 6 }}>{error}</div>}
      {result?.found && (
        <div style={{ fontSize: 12, marginTop: 8 }}>
          {result.display_name || 'Customer'} — {result.balance}/{result.reward_threshold} points
          {result.reward_available && <button onClick={redeem} disabled={redeeming} style={{ ...btn, marginLeft: 8, padding: '4px 10px' }}>{redeeming ? '…' : `Redeem: ${result.reward_description}`}</button>}
          {result.active_vouchers?.length > 0 && <div style={{ marginTop: 4, color: '#7c3aed' }}>Has a voucher: {result.active_vouchers.map((v: any) => v.code).join(', ')} — enter it in the discount code field.</div>}
        </div>
      )}
    </div>
  )
}
