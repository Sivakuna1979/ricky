// @ts-nocheck
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { Suspense } from 'react'

async function loginAction(formData: FormData) {
  'use server'
  const email    = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    redirect('/login?error=' + encodeURIComponent('Please enter your email and password.'))
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(list) {
          list.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options) } catch {}
          })
        },
      },
    }
  )

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    const msg = error?.message ?? 'Login failed — please try again.'
    redirect('/login?error=' + encodeURIComponent(msg))
  }

  const dest = data.user.email === 'sivakuna@icloud.com' ? '/admin/dashboard' : '/dashboard'
  redirect(dest)
}

function LoginPageInner({ error }: { error?: string }) {
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

        {error && (
          <div style={{ background:'rgba(239,68,68,.2)', border:'2px solid rgba(239,68,68,.5)', borderRadius:12, padding:'14px 16px', marginBottom:20, color:'#fca5a5', fontSize:14, lineHeight:1.5, fontWeight:500 }}>
            ⚠️ {error}
            {(error.toLowerCase().includes('invalid') || error.toLowerCase().includes('credentials') || error.toLowerCase().includes('confirm') || error.toLowerCase().includes('password')) && (
              <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid rgba(239,68,68,.3)' }}>
                <Link href="/forgot-password" style={{ color:'#fbbf24', textDecoration:'none', fontWeight:700, fontSize:13 }}>
                  → Forgot your password? Reset it here
                </Link>
              </div>
            )}
          </div>
        )}

        <form action={loginAction} style={{ background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:16, padding:28 }}>
          <div style={{ marginBottom:18 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:600, color:'rgba(255,255,255,.6)', marginBottom:6 }}>Email address</label>
            <input name="email" type="email" required autoComplete="email" placeholder="you@example.com"
              style={{ width:'100%', padding:'12px 14px', background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)', borderRadius:10, color:'#fff', fontSize:15, outline:'none', boxSizing:'border-box' }} />
          </div>
          <div style={{ marginBottom:8 }}>
            <label style={{ display:'block', fontSize:13, fontWeight:600, color:'rgba(255,255,255,.6)', marginBottom:6 }}>Password</label>
            <input name="password" type="password" required autoComplete="current-password" placeholder="••••••••"
              style={{ width:'100%', padding:'12px 14px', background:'rgba(255,255,255,.08)', border:'1px solid rgba(255,255,255,.15)', borderRadius:10, color:'#fff', fontSize:15, outline:'none', boxSizing:'border-box' }} />
          </div>
          <div style={{ textAlign:'right', marginBottom:22 }}>
            <Link href="/forgot-password" style={{ fontSize:13, color:'rgba(255,255,255,.35)', textDecoration:'none' }}>Forgot password?</Link>
          </div>
          <button type="submit"
            style={{ width:'100%', padding:'14px', background:'linear-gradient(135deg,#fbbf24,#f59e0b)', border:'none', borderRadius:50, color:'#0a0a14', fontWeight:800, fontSize:15, cursor:'pointer', fontFamily:'inherit' }}>
            Sign In
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

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams
  return <LoginPageInner error={params?.error} />
}
