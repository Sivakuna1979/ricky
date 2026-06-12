// @ts-nocheck
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [fullName, setFullName]     = useState('')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [done, setDone]             = useState(false)

  const inp: React.CSSProperties = {
    width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,.08)',
    border: '1px solid rgba(255,255,255,.15)', borderRadius: 10, color: '#fff',
    fontSize: 15, outline: 'none', boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: 'rgba(255,255,255,.6)', marginBottom: 6,
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!fullName || !email || !password) { setError('Please fill in all fields.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role: 'customer' } },
    })

    setLoading(false)
    if (authError) { setError(authError.message); return }
    setDone(true)
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
          <h1 style={{ fontSize:24, fontWeight:800, color:'#fff', margin:0 }}>Create your account</h1>
          <p style={{ color:'rgba(255,255,255,.4)', marginTop:6, fontSize:14 }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color:'#fbbf24', textDecoration:'none', fontWeight:600 }}>Sign in</Link>
          </p>
        </div>

        {done ? (
          <div style={{ background:'rgba(16,185,129,.15)', border:'1px solid rgba(16,185,129,.4)', borderRadius:14, padding:'28px 24px', textAlign:'center' }}>
            <div style={{ fontSize:44, marginBottom:12 }}>📧</div>
            <div style={{ color:'#6ee7b7', fontWeight:700, fontSize:17, marginBottom:8 }}>Check your email!</div>
            <div style={{ color:'rgba(255,255,255,.5)', fontSize:14, lineHeight:1.6, marginBottom:20 }}>
              We sent a confirmation link to <strong style={{ color:'#fff' }}>{email}</strong>.<br />
              Click the link to activate your account, then sign in.
            </div>
            <Link href="/login" style={{ display:'inline-block', padding:'11px 28px', borderRadius:50, background:'linear-gradient(135deg,#fbbf24,#f59e0b)', color:'#0a0a14', fontWeight:800, fontSize:14, textDecoration:'none' }}>
              Go to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:16, padding:28 }}>
            {error && (
              <div style={{ background:'rgba(239,68,68,.2)', border:'1px solid rgba(239,68,68,.4)', borderRadius:10, padding:'12px 14px', marginBottom:16, color:'#fca5a5', fontSize:14 }}>
                ⚠️ {error}
              </div>
            )}
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Full Name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} style={inp} placeholder="John Smith" autoComplete="name" />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inp} placeholder="you@example.com" autoComplete="email" />
            </div>
            <div style={{ marginBottom:16 }}>
              <label style={lbl}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inp} placeholder="At least 8 characters" autoComplete="new-password" />
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={lbl}>Confirm Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} style={inp} placeholder="••••••••" autoComplete="new-password" />
            </div>
            <button type="submit" disabled={loading}
              style={{ width:'100%', padding:'14px', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'none', borderRadius:50, color:'#0a0a14', fontWeight:800, fontSize:15, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily:'inherit' }}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        )}

        <p style={{ textAlign:'center', marginTop:20, fontSize:13, color:'rgba(255,255,255,.25)' }}>
          Food business?{' '}
          <Link href="/register/business" style={{ color:'#fbbf24', textDecoration:'none', fontWeight:600 }}>Register your business →</Link>
        </p>
      </div>
    </div>
  )
}
