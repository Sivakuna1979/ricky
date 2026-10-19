'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Send, Sparkles, Wand2 } from 'lucide-react'
import clsx from 'clsx'
import type { EditPatch } from '@/lib/edits'

interface Message {
  role: 'user' | 'assistant' | 'error'
  text: string
}

interface Props {
  mode: 'photo' | 'video'
  disabled?: boolean
  suggestions: string[]
  /** Builds the request context at send time (current settings + a preview snapshot). */
  getContext: () => { state: unknown; image?: string; duration?: number }
  onPatch: (patch: EditPatch) => void
}

export function AiPanel({ mode, disabled, suggestions, getContext, onPatch }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  async function send(instruction: string) {
    const text = instruction.trim()
    if (!text || busy || disabled) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text }])
    setBusy(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, instruction: text, ...getContext() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'The assistant is unavailable right now.')
      onPatch(data.patch as EditPatch)
      setMessages((m) => [...m, { role: 'assistant', text: data.reply }])
    } catch (err) {
      setMessages((m) => [...m, { role: 'error', text: err instanceof Error ? err.message : 'Something went wrong.' }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-3">
        <Sparkles className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold">AI assistant</h2>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div>
            <p className="mb-3 text-sm text-fg-3">Describe the edit you want. Claude looks at your {mode === 'photo' ? 'photo' : 'current frame'} and adjusts the settings — you can fine-tune anything afterwards.</p>
            <button className="btn-primary mb-3 w-full" disabled={disabled || busy} onClick={() => send('Auto enhance')}>
              <Wand2 className="h-4 w-4" /> Auto enhance
            </button>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button key={s} className="chip" disabled={disabled || busy} onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={clsx(
                'max-w-[90%] rounded-xl px-3 py-2 text-sm leading-relaxed',
                m.role === 'user' && 'ml-auto bg-accent text-white',
                m.role === 'assistant' && 'bg-ink-800 text-fg-2',
                m.role === 'error' && 'border border-rose-500/40 bg-rose-500/10 text-rose-200',
              )}
            >
              {m.text}
            </div>
          ))
        )}
        {busy ? (
          <div className="flex items-center gap-2 text-sm text-fg-3">
            <Loader2 className="h-4 w-4 animate-spin" /> Editing…
          </div>
        ) : null}
      </div>

      <form
        className="border-t border-ink-700 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <div className="flex items-end gap-2 rounded-xl border border-ink-700 bg-ink-900 p-1.5 focus-within:border-accent">
          <textarea
            rows={2}
            value={input}
            disabled={disabled}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            placeholder={disabled ? 'Open a file first' : mode === 'photo' ? 'e.g. make it moody and crop for Instagram' : 'e.g. cut to the first 15 seconds, vertical for TikTok'}
            className="min-h-0 flex-1 resize-none bg-transparent px-2 py-1 text-sm text-fg placeholder:text-fg-4 focus:outline-none"
          />
          <button type="submit" className="btn-primary !px-2.5" disabled={!input.trim() || busy || disabled} aria-label="Send">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  )
}
