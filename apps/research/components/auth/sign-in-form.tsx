'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/auth/browser'

export function SignInForm({ next = '/account' }: { next?: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const sb = supabaseBrowser()
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/account'

  if (!sb) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    const res =
      mode === 'sign-in'
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}` } })
    setBusy(false)
    if (res.error) return setMsg({ tone: 'err', text: res.error.message })
    if (mode === 'sign-up' && !res.data.session) return setMsg({ tone: 'ok', text: 'Check your email to confirm your account.' })
    router.push(safeNext)
    router.refresh()
  }

  const oauth = async (provider: 'google' | 'apple') => {
    await sb.auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}` } })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <button type="button" className="btn justify-center" onClick={() => oauth('google')}>
          Continue with Google
        </button>
        <button type="button" className="btn justify-center" onClick={() => oauth('apple')}>
          Continue with Apple
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs text-fg-4">
        <span className="h-px flex-1 bg-ink-700" /> or with email <span className="h-px flex-1 bg-ink-700" />
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input className="input" type="email" required autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className="input"
          type="password"
          required
          minLength={8}
          autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
          placeholder="Password (min. 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {msg && <p className={`text-sm ${msg.tone === 'err' ? 'text-neg' : 'text-pos'}`}>{msg.text}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary w-full justify-center disabled:opacity-60">
          {busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
        </button>
      </form>
      <p className="text-center text-sm text-fg-3">
        {mode === 'sign-in' ? 'New here?' : 'Already have an account?'}{' '}
        <button type="button" className="text-accent hover:underline" onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
          {mode === 'sign-in' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
    </div>
  )
}
