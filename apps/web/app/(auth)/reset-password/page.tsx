// @ts-nocheck
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ResetPasswordForm() {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState('')
  const searchParams              = useSearchParams()

  useEffect(() => {
    // Supabase sends access_token + refresh_token as hash params
    // The browser client picks them up automatically
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) { setError('Please enter a new password.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => { window.location.href = '/login' }, 2500)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a14', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <a href="/" style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:16, textDecoration:'none' }}>
            <div style={{ width:42, height:42, borderRadius:12, background:'linear-gradient(135deg,#f97316,#dc2626)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ color:'#fff', fontSize:15, fontWeight:900 }}>FT</span>
            </div>
            <span style={{ fontSize:22, fontWeight:800, color:'#fff', letterSpacing:'-0.04em' }}>Food<span style={{ color:'#f97316' }}>Taxi</span></span>
          </a>
          <h1 style={{ fontSize:24, fontWeight:800, color:'#fff', margin:0 }}>Set new password</h1>
          <p style={{ color:'rgba(255,255,255,.4)', marginTop:6, fontSize:14 }}>Enter and confirm your new password below</p>
        </div>

        {done ? (
          <div style={{ background:'rgba(16,185,129,.15)', border:'1px solid rgba(16,185,129,.4)', borderRadius:14, padding:'24px', textAlign:'center' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
            <div style={{ color:'#6ee7b7', fontWeight:700, fontSize:16, marginBottom:8 }}>Password updated!</div>
            <div style={{ color:'rgba(255,255,255,.5)', fontSize:14 }}>Redirecting you to sign in…</div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:16, padding:28 }}>
            {error && (
              <div style={{ background:'rgba(239,68,68,.2)', border:'1px solid rgba(239,68,68,.4)', borderRadius:10, padding:'12px 14px', marginBottom:16, color:'#fca5a5', fontSize:14 }}>
                ⚠️ {error}
              </div>
            )}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, color:'rgba(255,255,255,.6)', marginBottom:6 }}>New Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete="new-password"
                style={{ width:'100%', padding:'12px 14px', background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)', borderRadius:10, color:'#fff', fontSize:15, outline:'none', boxSizing:'border-box' }} />
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={{ display:'block', fontSize:13, fontWeight:600, color:'rgba(255,255,255,.6)', marginBottom:6 }}>Confirm Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat your new password" autoComplete="new-password"
                style={{ width:'100%', padding:'12px 14px', background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)', borderRadius:10, color:'#fff', fontSize:15, outline:'none', boxSizing:'border-box' }} />
            </div>
            <button type="submit" disabled={loading}
              style={{ width:'100%', padding:'14px', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'none', borderRadius:50, color:'#0a0a14', fontWeight:800, fontSize:15, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily:'inherit' }}>
              {loading ? 'Updating…' : 'Set New Password'}
            </button>
            <div style={{ textAlign:'center', marginTop:18 }}>
              <a href="/login" style={{ fontSize:13, color:'rgba(255,255,255,.35)', textDecoration:'none' }}>← Back to Sign In</a>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100vh', background:'#0a0a14' }} />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
