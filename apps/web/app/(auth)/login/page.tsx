// @ts-nocheck
'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    if (!email || !password) { setErrorMsg('Please enter your email and password.'); return }
    setLoading(true)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        // Show the raw Supabase error — never hide it
        setErrorMsg(`${error.message} (code: ${error.status ?? 'unknown'})`)
        setLoading(false)
        return
      }

      if (!data.user) {
        setErrorMsg('Login succeeded but no user returned — please try again.')
        setLoading(false)
        return
      }

      const dest = data.user.email === 'sivakuna@icloud.com' ? '/admin/dashboard' : '/dashboard'
      window.location.replace(dest)
    } catch (e: any) {
      setErrorMsg(`Network error: ${e?.message ?? 'unknown'}`)
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0a14', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px', fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif' }}>
      <div style={{ width:'100%', maxWidth:420 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <div style={{ width:42, height:42, borderRadius:12, background:'linear-gradient(135deg,#f97316,#dc2626)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <span style={{ color:'#fff', fontSize:15, fontWeight:900 }}>FT</span>
            </div>
            <span style={{ fontSize:22, fontWeight:800, color:'#fff', letterSpacing:'-0.04em' }}>
              Food<span style={{ color:'#f97316' }}>Taxi</span>
            </span>
          </div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'#fff', margin:0 }}>Sign in to your account</h1>
          <p style={{ color:'rgba(255,255,255,.4)', marginTop:6, fontSize:14 }}>
            Don&apos;t have an account?{' '}
            <Link href="/register" style={{ color:'#fbbf24', textDecoration:'none', fontWeight:600 }}>Register free</Link>
          </p>
        </div>

        {errorMsg && (
          <div style={{ background:'rgba(239,68,68,.2)', border:'2px solid rgba(239,68,68,.5)', borderRadius:12, padding:'14px 16px', marginBottom:20, color:'#fca5a5', fontSize:14, lineHeight:1.5, fontWeight:500 }}>
            ⚠️ {errorMsg}
            {(errorMsg.toLowerCase().includes('invalid') || errorMsg.toLowerCase().includes('credentials') || errorMsg.toLowerCase().includes('password')) && (
              <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid rgba(239,68,68,.3)' }}>
                <Link href="/forgot-password" style={{ color:'#fbbf24', textDecoration:'none', fontWeight:700, fontSize:13 }}>
                  → Reset your password
                </Link>
              </div>
            )}
          </div>
        )}

        <form onSubmit={onSubmit} style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:16, padding:28 }}>
          <div style={{ marginBottom:18 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:600, color:'rgba(255,255,255,.6)', marginBottom:6 }}>Email address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com"
              style={{ width:'100%', padding:'12px 14px', background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)', borderRadius:10, color:'#fff', fontSize:15, outline:'none', boxSizing:'border-box' }} />
          </div>
          <div style={{ marginBottom:8 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:600, color:'rgba(255,255,255,.6)', marginBottom:6 }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••"
              style={{ width:'100%', padding:'12px 14px', background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)', borderRadius:10, color:'#fff', fontSize:15, outline:'none', boxSizing:'border-box' }} />
          </div>
          <div style={{ textAlign:'right', marginBottom:22 }}>
            <Link href="/forgot-password" style={{ fontSize:13, color:'rgba(255,255,255,.35)', textDecoration:'none' }}>Forgot password?</Link>
          </div>
          <button type="submit" disabled={loading}
            style={{ width:'100%', padding:'14px', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'none', borderRadius:50, color:'#0a0a14', fontWeight:800, fontSize:15, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily:'inherit' }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign:'center', marginTop:20, fontSize:13, color:'rgba(255,255,255,.25)' }}>
          Food business?{' '}
          <Link href="/register/business" style={{ color:'#fbbf24', textDecoration:'none', fontWeight:600 }}>Register your business →</Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100vh', background:'#0a0a14' }} />}>
      <LoginForm />
    </Suspense>
  )
}
