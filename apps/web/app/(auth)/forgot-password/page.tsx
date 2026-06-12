// @ts-nocheck
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) { setError('Please enter your email address.'); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a14', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <Link href="/" style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:16, textDecoration:'none' }}>
            <div style={{ width:42, height:42, borderRadius:12, background:'linear-gradient(135deg,#f97316,#dc2626)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ color:'#fff', fontSize:15, fontWeight:900 }}>FT</span>
            </div>
            <span style={{ fontSize:22, fontWeight:800, color:'#fff', letterSpacing:'-0.04em' }}>Food<span style={{ color:'#f97316' }}>Taxi</span></span>
          </Link>
          <h1 style={{ fontSize:24, fontWeight:800, color:'#fff', margin:0 }}>Reset your password</h1>
          <p style={{ color:'rgba(255,255,255,.4)', marginTop:6, fontSize:14 }}>Enter your email and we'll send you a reset link</p>
        </div>

        {sent ? (
          <div style={{ background:'rgba(16,185,129,.15)', border:'1px solid rgba(16,185,129,.4)', borderRadius:14, padding:'24px', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📧</div>
            <div style={{ color:'#6ee7b7', fontWeight:700, fontSize:16, marginBottom:8 }}>Check your email</div>
            <div style={{ color:'rgba(255,255,255,.5)', fontSize:14, lineHeight:1.6 }}>
              We sent a password reset link to <strong style={{ color:'#fff' }}>{email}</strong>.<br />Check your inbox (and spam folder).
            </div>
            <Link href="/login" style={{ display:'inline-block', marginTop:20, padding:'10px 24px', borderRadius:10, background:'#f97316', color:'#fff', fontWeight:700, fontSize:14, textDecoration:'none' }}>
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:16, padding:28 }}>
            {error && (
              <div style={{ background:'rgba(239,68,68,.2)', border:'1px solid rgba(239,68,68,.4)', borderRadius:10, padding:'12px 14px', marginBottom:16, color:'#fca5a5', fontSize:14 }}>
                ⚠️ {error}
              </div>
            )}
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, color:'rgba(255,255,255,.6)', marginBottom:6 }}>Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email"
                style={{ width:'100%', padding:'12px 14px', background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)', borderRadius:10, color:'#fff', fontSize:15, outline:'none', boxSizing:'border-box' }} />
            </div>
            <button type="submit" disabled={loading}
              style={{ width:'100%', padding:'14px', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'none', borderRadius:50, color:'#0a0a14', fontWeight:800, fontSize:15, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
            <div style={{ textAlign:'center', marginTop:18 }}>
              <Link href="/login" style={{ fontSize:13, color:'rgba(255,255,255,.35)', textDecoration:'none' }}>← Back to Sign In</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
