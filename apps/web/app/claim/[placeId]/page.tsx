// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const CATEGORIES = [
  ['fish_and_chips', '🐟 Fish & Chips'], ['burger', '🍔 Burger Van'],
  ['pizza', '🍕 Pizza'], ['coffee', '☕ Coffee'], ['ice_cream', '🍦 Ice Cream'],
  ['dessert', '🍰 Dessert'], ['street_food', '🥙 Street Food'],
  ['catering_trailer', '🚚 Catering'], ['other', '🍽️ Other'],
]

export default function ClaimPage() {
  const { placeId } = useParams<{ placeId: string }>()
  const [biz, setBiz]         = useState<any>(null)
  const [loadingBiz, setLB]   = useState(true)
  const [submitting, setSub]  = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState('')

  // Form fields
  const [name, setName]               = useState('')
  const [businessName, setBizName]    = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [phone, setPhone]             = useState('')
  const [website, setWebsite]         = useState('')
  const [address, setAddress]         = useState('')
  const [category, setCategory]       = useState('other')

  useEffect(() => {
    if (!placeId) return
    fetch(`/api/places/claim?place_id=${placeId}`)
      .then(r => r.json())
      .then(d => {
        setBiz(d)
        setBizName(d.name ?? '')
        setPhone(d.phone ?? '')
        setWebsite(d.website ?? '')
        setAddress(d.address ?? '')
        if (d.category) {
          const match = CATEGORIES.find(([v]) => v === d.category)
          if (match) setCategory(d.category)
        }
        setLB(false)
      })
      .catch(() => { setError('Could not load this business.'); setLB(false) })
  }, [placeId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!name || !businessName || !email || !password) {
      setError('Please fill in your name, business name, email and password.'); return
    }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setSub(true)

    const res = await fetch('/api/places/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        place_id: placeId, name, business_name: businessName, email, password,
        phone, website, address, business_type: category,
      }),
    })
    const data = await res.json()
    setSub(false)
    if (!res.ok) { setError(data.error ?? 'Registration failed.'); return }
    setDone(true)
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,.06)',
    border: '1px solid rgba(255,255,255,.14)', borderRadius: 10, color: '#fff',
    fontSize: 15, outline: 'none', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.5)', marginBottom: 5 }

  if (loadingBiz) {
    return <div style={{ minHeight: '100vh', background: '#080c18', color: 'rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading business…</div>
  }

  if (biz?.already_claimed) {
    return (
      <div style={{ minHeight: '100vh', background: '#080c18', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: '-apple-system,sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 10px' }}>Already Claimed</h1>
          <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
            This business has already been registered on FoodTaxi. If it's yours, just sign in.
          </p>
          <Link href="/login" style={{ display: 'inline-block', padding: '13px 30px', borderRadius: 12, background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', fontWeight: 700, textDecoration: 'none' }}>Sign In</Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div style={{ minHeight: '100vh', background: '#080c18', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: '-apple-system,sans-serif' }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 10px' }}>Welcome to FoodTaxi!</h1>
          <p style={{ color: 'rgba(255,255,255,.55)', fontSize: 15, lineHeight: 1.6, marginBottom: 28 }}>
            <strong style={{ color: '#fff' }}>{businessName}</strong> is now registered. Sign in to add your menu, enable live GPS tracking, and start taking orders.
          </p>
          <Link href="/login" style={{ display: 'inline-block', padding: '14px 34px', borderRadius: 12, background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none' }}>Sign In to Your Dashboard →</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080c18', padding: '32px 16px', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(135deg,#f97316,#ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>🚐</div>
            <span style={{ fontSize: 21, fontWeight: 800, color: '#fff' }}>FoodTaxi</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: '0 0 8px' }}>Claim Your Free Profile</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,.45)', margin: 0, lineHeight: 1.5 }}>
            We found your business on Google. Register to get live tracking, online orders, event bookings & more — free.
          </p>
        </div>

        {/* Discovered business card */}
        <div style={{ background: 'rgba(249,115,22,.08)', border: '1px solid rgba(249,115,22,.25)', borderRadius: 14, padding: 16, marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#fb923c', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>📍 Discovered on Google</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{biz?.name ?? 'Your Business'}</div>
          {biz?.address && <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 3 }}>{biz.address}</div>}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: 'rgba(255,255,255,.45)', marginTop: 6 }}>
            {biz?.phone && <span>📞 {biz.phone}</span>}
            {biz?.rating && <span>⭐ {biz.rating}</span>}
            {biz?.website && <span>🌐 Website</span>}
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.35)', borderRadius: 10, padding: '12px 14px', marginBottom: 18, color: '#fca5a5', fontSize: 13.5 }}>
            ⚠️ {error}
            {/already|exists|claimed/i.test(error) && (
              <div style={{ marginTop: 8 }}>
                <Link href="/login" style={{ color: '#fbbf24', fontWeight: 700, textDecoration: 'none' }}>→ Sign in instead</Link>
              </div>
            )}
          </div>
        )}

        {/* Registration form */}
        <form onSubmit={submit} style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 18, padding: 24 }}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={lbl}>Your Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} style={inp} placeholder="John Smith" />
            </div>
            <div>
              <label style={lbl}>Business Name *</label>
              <input value={businessName} onChange={e => setBizName(e.target.value)} style={inp} placeholder="Smith's Fish & Chips" />
            </div>
            <div>
              <label style={lbl}>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
                {CATEGORIES.map(([v, l]) => <option key={v} value={v} style={{ background: '#0a0f1e' }}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Email * <span style={{ color: 'rgba(255,255,255,.3)', fontWeight: 400 }}>(Google doesn't share this — enter yours)</span></label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value.trim())} style={inp} placeholder="you@business.com" />
            </div>
            <div>
              <label style={lbl}>Create Password *</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inp} placeholder="At least 8 characters" />
            </div>
            <div>
              <label style={lbl}>Phone {biz?.phone && <span style={{ color: '#6ee7b7', fontWeight: 400 }}>· pre-filled from Google</span>}</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} style={inp} placeholder="07700 900000" />
            </div>
            <div>
              <label style={lbl}>Address</label>
              <input value={address} onChange={e => setAddress(e.target.value)} style={inp} placeholder="Business address" />
            </div>
            <div>
              <label style={lbl}>Website</label>
              <input value={website} onChange={e => setWebsite(e.target.value)} style={inp} placeholder="https://…" />
            </div>
          </div>

          <button type="submit" disabled={submitting}
            style={{ width: '100%', marginTop: 22, padding: '15px', borderRadius: 12, border: 'none', background: submitting ? 'rgba(249,115,22,.5)' : 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: submitting ? 'wait' : 'pointer' }}>
            {submitting ? 'Creating your profile…' : '🚀 Claim & Register Free'}
          </button>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,.3)', marginTop: 14 }}>
            Already registered?{' '}
            <Link href="/login" style={{ color: '#f97316', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
