// @ts-nocheck
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// Bump on every login change so we can confirm the live deploy.
const BUILD_TAG = 'login-v12 · 2026-06-13'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [debug, setDebug]       = useState<any>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setLoading(true)

    const supabase = createClient()
    const dbg: any = {
      step: 'start',
      url: typeof window !== 'undefined' ? window.location.href : '',
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '(missing)',
      anonKeySet: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      email,
    }
    setDebug({ ...dbg })

    // 1. Sign in
    const { data, error: sbError } = await supabase.auth.signInWithPassword({ email, password })
    dbg.step          = 'after-signin'
    dbg.errorMessage  = sbError?.message ?? null
    dbg.errorStatus   = sbError?.status ?? null
    dbg.errorName     = sbError?.name ?? null
    dbg.userExists    = !!data?.user
    dbg.userEmail     = data?.user?.email ?? null
    dbg.emailConfirmed= data?.user?.email_confirmed_at ? true : (data?.user ? false : 'unknown')
    setDebug({ ...dbg })

    if (sbError) {
      console.error('[FoodTaxi login] auth error:', sbError)
      setError(sbError.message)
      setLoading(false)
      return
    }

    // 2. Confirm session is set client-side after sign-in
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      dbg.clientSessionExists = !!sessionData?.session
      dbg.clientSessionEmail  = sessionData?.session?.user?.email ?? null
    } catch (e) {
      dbg.clientSessionError = String(e)
    }
    setDebug({ ...dbg })

    // 3. Also probe server-side session (tells us if the cookie is readable by the server)
    try {
      const probe = await fetch('/api/debug/session', { cache: 'no-store' })
      const pd = await probe.json()
      dbg.serverCookies   = pd.sbCookieNames
      dbg.serverSession   = pd.sessionExists
      dbg.serverSessionEmail = pd.sessionEmail
      dbg.serverUser      = pd.userExists
      dbg.serverUserError = pd.userError
      dbg.totalCookies    = pd.totalCookies
    } catch (e) {
      dbg.probeError = String(e)
    }

    // 4. Redirect — super admin → /admin, everyone else → /dashboard
    const redirect = data.user?.email === 'sivakuna@icloud.com' ? '/admin' : '/dashboard'
    dbg.step         = 'redirecting'
    dbg.finalRedirect = redirect
    setDebug({ ...dbg })
    setTimeout(() => window.location.replace(redirect), 500) // pause so debug is visible
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '12px 14px',
    background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)',
    borderRadius: 10, color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a14', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#f97316,#dc2626)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: 15, fontWeight: 900 }}>FT</span>
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em' }}>
              Food<span style={{ color: '#f97316' }}>Taxi</span>
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', margin: 0 }}>Sign in to your account</h1>
          <p style={{ color: 'rgba(255,255,255,.4)', marginTop: 6, fontSize: 14 }}>
            Don&apos;t have an account?{' '}
            <Link href="/register" style={{ color: '#fbbf24', textDecoration: 'none', fontWeight: 600 }}>Register free</Link>
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(239,68,68,.2)', border: '2px solid rgba(239,68,68,.5)', borderRadius: 12, padding: '14px 16px', marginBottom: 16, color: '#fca5a5', fontSize: 14, lineHeight: 1.5 }}>
            ⚠️ {error}
            <div style={{ marginTop: 10 }}>
              <Link href="/forgot-password" style={{ color: '#fbbf24', textDecoration: 'none', fontWeight: 700, fontSize: 13 }}>
                → Reset your password
              </Link>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: 28 }}>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.6)', marginBottom: 6 }}>Email address</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value.trim())}
              autoComplete="email" placeholder="you@example.com" style={inp}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.6)', marginBottom: 6 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="current-password" placeholder="••••••••" style={{ ...inp, paddingRight: 64 }}
              />
              <button type="button" onClick={() => setShowPw(s => !s)}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 7, color: '#fbbf24', fontSize: 12, fontWeight: 700, padding: '6px 10px', cursor: 'pointer' }}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div style={{ textAlign: 'right', marginBottom: 22 }}>
            <Link href="/forgot-password" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Forgot password?</Link>
          </div>
          <button
            type="submit" disabled={loading}
            style={{ width: '100%', padding: '14px', background: loading ? 'rgba(251,191,36,.5)' : 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 50, color: '#0a0a14', fontWeight: 800, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Always-visible debug box */}
        <div style={{ marginTop: 16, background: 'rgba(0,0,0,.4)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.45)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
            🐞 Test Login Debug
          </div>
          {debug ? (
            <pre style={{ margin: 0, color: '#a7f3d0', fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
{JSON.stringify(debug, null, 2)}
            </pre>
          ) : (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>Press “Sign In” to run diagnostics…</div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'rgba(255,255,255,.25)' }}>
          Food business?{' '}
          <Link href="/register/business" style={{ color: '#fbbf24', textDecoration: 'none', fontWeight: 600 }}>Register your business →</Link>
        </p>

        <p style={{ textAlign: 'center', marginTop: 14, fontSize: 10, color: 'rgba(255,255,255,.25)', letterSpacing: '0.05em' }}>
          {BUILD_TAG}
        </p>
      </div>
    </div>
  )
}
