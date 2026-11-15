// @ts-nocheck
'use client'
// Temporary diagnostic page — not linked from anywhere in the app.
// Runs the same raw connectivity checks as the real auth pages, but
// surfaces full error detail instead of a generic message, so we can see
// exactly where/why Supabase Auth calls are failing in production.
// Delete this route once the underlying issue is found and fixed.
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function describeError(err: any) {
  const lines: string[] = []
  lines.push('name: ' + err?.name)
  lines.push('message: ' + err?.message)
  if (err?.status !== undefined) lines.push('status: ' + err.status)
  if (err?.cause) lines.push('cause: ' + String(err.cause))
  try { lines.push('full: ' + JSON.stringify(err, Object.getOwnPropertyNames(err))) } catch {}
  return lines.join('\n')
}

export default function DebugSupabasePage() {
  const [out, setOut] = useState<Record<string, string>>({ t1: '—', t2: '—', t3: '—' })
  const [running, setRunning] = useState(false)

  const set = (k: string, v: string) => setOut(prev => ({ ...prev, [k]: v }))

  const run = async () => {
    setRunning(true)

    // Test 1 — raw fetch, no library, no headers
    {
      const started = Date.now()
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`)
        const ms = Date.now() - started
        const text = await res.text().catch(() => '(no body)')
        set('t1', `HTTP ${res.status} ${res.statusText} (${ms}ms)\n\n${text}`)
      } catch (err: any) {
        set('t1', `Threw after ${Date.now() - started}ms\n\n${describeError(err)}`)
      }
    }

    // Test 2 — raw fetch with the real anon key
    {
      const started = Date.now()
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
          headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string },
        })
        const ms = Date.now() - started
        const text = await res.text().catch(() => '(no body)')
        set('t2', `HTTP ${res.status} ${res.statusText} (${ms}ms)\n\n${text}`)
      } catch (err: any) {
        set('t2', `Threw after ${Date.now() - started}ms\n\n${describeError(err)}`)
      }
    }

    // Test 3 — the exact supabase-js call the real pages make
    {
      const started = Date.now()
      try {
        const supabase = createClient()
        const testEmail = `diagnostic-${Date.now()}@example.com`
        const { data, error } = await supabase.auth.signUp({ email: testEmail, password: 'DiagnosticTest123!' })
        const ms = Date.now() - started
        if (error) {
          set('t3', `supabase-js returned an error after ${ms}ms\nTest email: ${testEmail}\n\n${describeError(error)}`)
        } else {
          set('t3', `Success after ${ms}ms\nTest email: ${testEmail}\nUser id: ${data?.user?.id}`)
        }
      } catch (err: any) {
        set('t3', `Threw after ${Date.now() - started}ms\n\n${describeError(err)}`)
      }
    }

    setRunning(false)
  }

  const copyAll = async () => {
    const text = `=== Test 1: Health ===\n${out.t1}\n\n=== Test 2: Settings ===\n${out.t2}\n\n=== Test 3: Sign-up ===\n${out.t3}`
    try { await navigator.clipboard.writeText(text) } catch {}
    alert('Copied (or select the text below manually if copy failed).')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a14', color: '#fff', padding: 20, fontFamily: '-apple-system,BlinkMacSystemFont,sans-serif' }}>
      <h1 style={{ fontSize: 18, fontWeight: 800 }}>Supabase Connection Test (live site)</h1>
      <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 13, marginBottom: 16 }}>
        Running on thefoodtaxi.com itself — real CSP, real cookies, real everything.
      </p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <button onClick={run} disabled={running} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 13 }}>
          {running ? 'Running…' : 'Run All Tests'}
        </button>
        <button onClick={copyAll} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,.15)', color: '#fff', fontWeight: 700, fontSize: 13 }}>
          Copy Results
        </button>
      </div>
      {(['t1', 't2', 't3'] as const).map((k, i) => (
        <div key={k} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Test {i + 1}: {['Health check', 'Auth settings', 'Real sign-up attempt'][i]}</div>
          <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, color: 'rgba(255,255,255,.8)' }}>{out[k]}</pre>
        </div>
      ))}
    </div>
  )
}
