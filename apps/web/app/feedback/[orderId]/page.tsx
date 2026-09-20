// @ts-nocheck
'use client'
// I45 — public feedback page, linked from the feedback-request email.
// Posts to /api/crm/feedback, which treats the order id itself as the
// capability proving this is that order's customer (same pattern as
// /receipt/[id] and /order-status/[vanId]).
import { useState } from 'react'
import { useParams } from 'next/navigation'

export default function FeedbackPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!rating) return
    setSaving(true); setError('')
    const res = await fetch('/api/crm/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: orderId, rating, comment }) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Could not submit feedback'); return }
    setSubmitted(true)
  }

  return (
    <div style={{ maxWidth: 420, margin: '60px auto', padding: 20, fontFamily: '-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif', textAlign: 'center' }}>
      {submitted ? (
        <>
          <div style={{ fontSize: 40 }}>🙏</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 10 }}>Thanks for your feedback!</div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>How was your order?</div>
          <div style={{ fontSize: 36, marginBottom: 16 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <span key={n} onClick={() => setRating(n)} style={{ cursor: 'pointer', color: n <= rating ? '#f59e0b' : '#e5e7eb' }}>★</span>
            ))}
          </div>
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Anything you'd like to add? (optional)" style={{ width: '100%', minHeight: 90, padding: 10, borderRadius: 10, border: '1px solid #e5e7eb', boxSizing: 'border-box', fontSize: 14 }} />
          {error && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</div>}
          <button onClick={submit} disabled={!rating || saving} style={{ marginTop: 14, width: '100%', padding: 12, borderRadius: 10, border: 'none', background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: !rating || saving ? 0.5 : 1 }}>{saving ? 'Sending…' : 'Submit feedback'}</button>
        </>
      )}
    </div>
  )
}
