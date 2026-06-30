'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function RegisterForm() {
  const router = useRouter()
  const params = useSearchParams()
  const plan = params.get('plan') ?? 'free'
  const [workspaceName, setWorkspaceName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { workspace_name: workspaceName, selected_plan: plan },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setLoading(false)
    if (error) return setError(error.message)
    if (data.session) {
      router.push('/dashboard')
      router.refresh()
    } else {
      setNotice('Check your email to confirm your account, then log in.')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-center text-xl font-bold text-brand">
          AgentHub
        </Link>
        <div className="card">
          <h1 className="mb-1 text-xl font-bold">Create your workspace</h1>
          <p className="mb-4 text-sm text-neutral-600">Selected plan: <span className="font-medium capitalize">{plan}</span></p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Workspace name</label>
              <input className="input" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="Acme Inc" required />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {notice && <p className="text-sm text-green-700">{notice}</p>}
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? 'Creating…' : 'Create account'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-neutral-600">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-brand">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  )
}
