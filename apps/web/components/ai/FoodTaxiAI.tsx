// @ts-nocheck
'use client'

import { useEffect, useRef, useState } from 'react'

const QUICK_PROMPTS = ['How are we doing today?', "What needs my attention?", 'What stock is running low?', 'How much did we make yesterday?', 'Who is working today?', 'Which vehicles need attention?']
const CHIP_ACTIONS = [
  { label: 'TODAY', prompt: 'How are we doing today?' },
  { label: 'SALES', prompt: 'How much did we make this week?' },
  { label: 'STOCK', prompt: 'What stock is running low?' },
  { label: 'STAFF', prompt: 'Who is working today?' },
  { label: 'HYGIENE', prompt: 'What hygiene checks are outstanding?' },
  { label: 'VEHICLES', prompt: 'Which vehicles need attention?' },
  { label: 'EVENTS', prompt: 'What events are coming up?' },
]

export function FoodTaxiAI() {
  const [conversations, setConversations] = useState<any[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [pendingActions, setPendingActions] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)

  const loadConversations = () => fetch('/api/ai/conversations').then(r => r.json()).then(d => setConversations(Array.isArray(d) ? d : []))
  useEffect(() => { loadConversations() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const recognition = new SR()
    recognition.lang = 'en-GB'
    recognition.interimResults = false
    recognition.onresult = (e: any) => { setInput(e.results[0][0].transcript); setListening(false) }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    setVoiceSupported(true)
  }, [])

  const openConversation = async (id: string) => {
    setShowHistory(false)
    const data = await fetch(`/api/ai/conversations/${id}`).then(r => r.json())
    setConversationId(id)
    setMessages(data.messages ?? [])
    setPendingActions(data.pending_actions ?? [])
  }

  const newChat = () => { setConversationId(null); setMessages([]); setPendingActions([]); setShowHistory(false) }

  const deleteConversation = async (id: string, e: any) => {
    e.stopPropagation()
    await fetch(`/api/ai/conversations/${id}`, { method: 'DELETE' })
    if (id === conversationId) newChat()
    loadConversations()
  }

  const send = async (text?: string) => {
    const question = (text ?? input).trim()
    if (!question || loading) return
    setInput(''); setError(''); setLoading(true)
    setMessages(m => [...m, { role: 'user', content: question }])

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, message: question }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong.'); setLoading(false); return }
      setConversationId(data.conversation_id)
      setMessages(m => [...m, { role: 'assistant', content: data.message, sources: data.sources }])
      setPendingActions(data.pending_actions ?? [])
      loadConversations()
    } catch {
      setError('Network error — please try again.')
    }
    setLoading(false)
  }

  const confirmAction = async (id: string, actionType?: string) => {
    const res = await fetch(`/api/ai/actions/${id}/confirm`, { method: 'POST' })
    const data = await res.json()
    setPendingActions(p => p.filter(a => a.id !== id))
    const successMessage = actionType === 'create_stock_transfer'
      ? '✅ Done — stock transfer created for you to review under Stock → Movements.'
      : '✅ Done — purchase order created as a draft for you to review under Suppliers.'
    setMessages(m => [...m, { role: 'assistant', content: res.ok ? successMessage : `❌ ${data.error}` }])
  }
  const cancelAction = async (id: string) => {
    await fetch(`/api/ai/actions/${id}/cancel`, { method: 'POST' })
    setPendingActions(p => p.filter(a => a.id !== id))
  }

  const toggleVoice = () => {
    if (!recognitionRef.current) return
    if (listening) { recognitionRef.current.stop(); setListening(false) }
    else { recognitionRef.current.start(); setListening(true) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 180px)', minHeight: 400, background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ fontWeight: 800, fontSize: 14 }}>🤖 FoodTaxi AI</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowHistory(v => !v)} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>History</button>
          <button onClick={newChat} style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ New chat</button>
        </div>
      </div>

      {showHistory && (
        <div style={{ position: 'absolute', top: 46, right: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: 240, maxHeight: 300, overflowY: 'auto', zIndex: 10 }}>
          {conversations.length === 0 ? <div style={{ padding: 12, fontSize: 12, color: '#888' }}>No previous chats</div> : conversations.map(c => (
            <div key={c.id} onClick={() => openConversation(c.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: 12 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || 'Conversation'}</span>
              <button onClick={(e) => deleteConversation(c.id, e)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 11, cursor: 'pointer' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 10px' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Ask FoodTaxi about your business</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 340, margin: '0 auto' }}>
              {QUICK_PROMPTS.map(q => (
                <button key={q} onClick={() => send(q)} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#f9fafb', textAlign: 'left', fontSize: 13, color: '#333', cursor: 'pointer' }}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
            <div style={{ maxWidth: '85%', padding: '10px 14px', borderRadius: 14, background: m.role === 'user' ? '#f97316' : '#f3f4f6', color: m.role === 'user' ? '#fff' : '#111', fontSize: 14, whiteSpace: 'pre-line' }}>
              {m.content}
              {m.sources?.length > 0 && (
                <div style={{ fontSize: 10, color: m.role === 'user' ? 'rgba(255,255,255,0.7)' : '#999', marginTop: 6 }}>
                  Source: {m.sources.map((s: string) => s.replace(/_/g, ' ')).join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}
        {pendingActions.map(a => (
          <div key={a.id} style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
              {a.action_type === 'create_stock_transfer' ? '🚐 Draft stock transfer to van' : `📋 Draft purchase order — ${a.params.supplier_name}`}
            </div>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>
              {a.params.items.map((i: any) => `${i.quantity} × ${i.name}`).join(', ')}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => confirmAction(a.id, a.action_type)} style={{ padding: '8px 16px', borderRadius: 8, background: '#059669', color: '#fff', border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Confirm</button>
              <button onClick={() => cancelAction(a.id)} style={{ padding: '8px 16px', borderRadius: 8, background: '#f5f6fa', color: '#374151', border: '1px solid #e5e7eb', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ))}
        {loading && <div style={{ fontSize: 13, color: '#888', padding: '6px 0' }}>FoodTaxi AI is thinking…</div>}
        {error && <div style={{ fontSize: 13, color: '#dc2626', padding: '6px 0' }}>{error}</div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '8px 12px', overflowX: 'auto', borderTop: '1px solid #f3f4f6' }}>
        {CHIP_ACTIONS.map(c => (
          <button key={c.label} onClick={() => send(c.prompt)} style={{ padding: '6px 12px', borderRadius: 16, border: '1px solid #e5e7eb', background: '#fff', color: '#555', fontSize: 11, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>{c.label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid #f3f4f6', background: '#fff' }}>
        {voiceSupported && (
          <button onClick={toggleVoice} style={{ width: 40, height: 40, borderRadius: 20, border: 'none', background: listening ? '#dc2626' : '#f3f4f6', color: listening ? '#fff' : '#555', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>🎤</button>
        )}
        <input
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') send() }}
          placeholder="Ask about your business…"
          style={{ flex: 1, padding: '10px 14px', borderRadius: 20, border: '1px solid #e5e7eb', fontSize: 14, outline: 'none' }}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} style={{ width: 40, height: 40, borderRadius: 20, border: 'none', background: '#f97316', color: '#fff', fontSize: 16, cursor: 'pointer', flexShrink: 0, opacity: loading || !input.trim() ? 0.5 : 1 }}>➤</button>
      </div>
    </div>
  )
}
