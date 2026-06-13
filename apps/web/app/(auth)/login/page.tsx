// @ts-nocheck
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setLoading(true)

    const supabase = createClient()
    const { data, error: sbError } = await supabase.auth.signInWithPassword({ email, password })

    if (sbError) {
      setError(sbError.message)
      setLoading(false)
      return
    }

    // Redirect based on role
    const dest = data.user?.email === 'sivakuna@icloud.com' ? '/admin/dashboard' : '/dashboard'
    window.location.replace(dest)
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
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
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
          <div style={{ background: 'rgba(239,68,68,.2)', border: '2px solid rgba(239,68,68,.5)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, color: '#fca5a5', fontSize: 14, lineHeight: 1.5 }}>
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
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              autoComplete="email" placeholder="you@example.com" style={inp}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.6)', marginBottom: 6 }}>Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="current-password" placeholder="••••••••" style={inp}
            />
          </div>
          <div style={{ textAlign: 'right', marginBottom: 24 }}>
            <Link href="/forgot-password" style={{ fontSize: 13, color: 'rgba(255,255,255,.35)', textDecoration: 'none' }}>Forgot password?</Link>
          </div>
          <button
            type="submit" disabled={loading}
            style={{ width: '100%', padding: '14px', background: loading ? 'rgba(251,191,36,.5)' : 'linear-gradient(135deg,#fbbf24,#f59e0b)', border: 'none', borderRadius: 50, color: '#0a0a14', fontWeight: 800, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background .2s' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,.25)' }}>
          Food business?{' '}
          <Link href="/register/business" style={{ color: '#fbbf24', textDecoration: 'none', fontWeight: 600 }}>Register your business →</Link>
        </p>
      </div>
    </div>
  )
}
