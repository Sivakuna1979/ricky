'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Bot, Lock, Send, User } from 'lucide-react'
import { Markdown } from './markdown'

interface Msg {
  role: 'user' | 'assistant'
  content: string
  source?: string
}

export function Chat({ tickers = [], suggestions, enabled, compact = false }: { tickers?: string[]; suggestions: string[]; enabled: boolean; compact?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  if (!enabled)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-ink-600 p-4 text-sm text-fg-3">
        <Lock className="h-4 w-4 text-neu" /> The AI research assistant is part of Premium.{' '}
        <Link href="/pricing" className="text-accent hover:underline">
          See plans
        </Link>
      </div>
    )

  const ask = async (q: string) => {
    const question = q.trim()
    if (!question || busy) return
    const history = msgs.slice(-10).map(({ role, content }) => ({ role, content }))
    setMsgs((m) => [...m, { role: 'user', content: question }, { role: 'assistant', content: '' }])
    setInput('')
    setBusy(true)
    try {
      const res = await fetch('/api/ai/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, tickers, history }) })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        setMsgs((m) => [...m.slice(0, -1), { role: 'assistant', content: `_${err.error ?? 'Request failed'}_` }])
        return
      }
      const source = res.headers.get('X-Answer-Source') ?? undefined
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let acc = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        acc += dec.decode(value, { stream: true })
        setMsgs((m) => [...m.slice(0, -1), { role: 'assistant', content: acc, source }])
        endRef.current?.scrollIntoView({ block: 'nearest' })
      }
    } catch {
      setMsgs((m) => [...m.slice(0, -1), { role: 'assistant', content: '_Network error — please try again._' }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={`scrollbar-thin space-y-4 overflow-y-auto ${compact ? 'max-h-[480px]' : 'max-h-[62vh] min-h-[240px]'}`}>
        {msgs.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s} type="button" onClick={() => ask(s)} className="chip border-ink-600 bg-ink-900 py-1 text-left text-sm text-fg-2 hover:border-accent/50 hover:text-fg">
                {s}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className="flex gap-3">
            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${m.role === 'user' ? 'bg-ink-700' : 'bg-accent-soft text-accent'}`}>
              {m.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1 text-sm leading-relaxed text-fg-2">
              {m.role === 'assistant' ? m.content ? <Markdown text={m.content} /> : <span className="animate-pulse text-fg-4">Analysing the data…</span> : <p className="text-fg">{m.content}</p>}
              {m.role === 'assistant' && m.source && m.content && (
                <div className="mt-1 text-[10px] uppercase tracking-wider text-fg-4">{m.source === 'claude' ? 'Claude · grounded in platform data' : 'Rules-based answer from computed data'}</div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void ask(input)
        }}
        className="flex gap-2"
      >
        <input className="input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about debt, ROIC, valuation, risks, competitors…" maxLength={1000} disabled={busy} />
        <button className="btn btn-primary shrink-0" disabled={busy || !input.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </button>
      </form>
      <p className="text-[11px] text-fg-4">Answers use only the platform’s computed data and label facts, expectations, assumptions and uncertainty. Not personalised financial advice.</p>
    </div>
  )
}
