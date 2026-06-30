'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Link as LinkIcon, CheckCircle2, XCircle } from 'lucide-react'
import type { Channel, ChannelType, Agent } from '@/lib/types'

export default function ChannelManager({
  channels,
  agents,
  appUrl,
}: {
  channels: Channel[]
  agents: Agent[]
  appUrl: string
}) {
  const router = useRouter()
  const [type, setType] = useState<ChannelType>('telegram')
  const [name, setName] = useState('')
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '')
  const [creds, setCreds] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setCred(k: string, v: string) {
    setCreds((c) => ({ ...c, [k]: v }))
  }

  async function create() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, name, agent_id: agentId, credentials: creds }),
    })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      return setError(d.error ?? 'Failed to create channel')
    }
    setName('')
    setCreds({})
    router.refresh()
  }

  async function connect(id: string) {
    setBusy(true)
    const res = await fetch(`/api/channels/${id}/connect`, { method: 'POST' })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      alert(d.error ?? 'Connect failed')
    }
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Delete this channel?')) return
    await fetch(`/api/channels/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className="space-y-8">
      {/* Existing channels */}
      <div className="space-y-3">
        {channels.map((ch) => {
          const webhookUrl =
            ch.type === 'telegram'
              ? `${appUrl}/api/webhooks/telegram/${ch.webhook_secret}`
              : `${appUrl}/api/webhooks/whatsapp/${ch.webhook_secret}`
          return (
            <div key={ch.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 font-semibold">
                    {ch.name}
                    <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs capitalize">{ch.type}</span>
                    {ch.status === 'connected' ? (
                      <span className="flex items-center gap-1 text-xs text-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> connected
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-neutral-500">
                        <XCircle className="h-3.5 w-3.5" /> {ch.status}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-neutral-500">Webhook URL</div>
                  <code className="block break-all rounded bg-neutral-50 p-2 text-xs">{webhookUrl}</code>
                  {ch.type === 'whatsapp' && (
                    <p className="mt-1 text-xs text-neutral-500">
                      Verify token: <code>{ch.credentials?.verify_token ?? '(set on create)'}</code> · paste
                      this URL + token into Meta → WhatsApp → Configuration → Webhook.
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button className="btn-outline" onClick={() => connect(ch.id)} disabled={busy}>
                    <LinkIcon className="mr-1 h-4 w-4" /> Connect
                  </button>
                  <button className="btn-outline" onClick={() => remove(ch.id)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {!channels.length && <p className="text-sm text-neutral-500">No channels connected yet.</p>}
      </div>

      {/* Create new */}
      <div className="card">
        <h2 className="mb-4 font-semibold">Add a channel</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Channel type</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as ChannelType)}>
              <option value="telegram">Telegram</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
          <div>
            <label className="label">Display name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Support bot" />
          </div>
          <div className="col-span-2">
            <label className="label">Assign agent</label>
            <select className="input" value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {type === 'telegram' ? (
            <div className="col-span-2">
              <label className="label">Bot token (from @BotFather)</label>
              <input
                className="input"
                value={creds.bot_token ?? ''}
                onChange={(e) => setCred('bot_token', e.target.value)}
                placeholder="123456:ABC-DEF…"
              />
            </div>
          ) : (
            <>
              <div className="col-span-2">
                <label className="label">Access token (permanent / system user)</label>
                <input className="input" value={creds.access_token ?? ''} onChange={(e) => setCred('access_token', e.target.value)} />
              </div>
              <div>
                <label className="label">Phone number ID</label>
                <input className="input" value={creds.phone_number_id ?? ''} onChange={(e) => setCred('phone_number_id', e.target.value)} />
              </div>
              <div>
                <label className="label">Verify token (choose any string)</label>
                <input className="input" value={creds.verify_token ?? ''} onChange={(e) => setCred('verify_token', e.target.value)} />
              </div>
            </>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button className="btn-primary mt-4" onClick={create} disabled={busy || !name}>
          {busy ? 'Saving…' : 'Add channel'}
        </button>
      </div>
    </div>
  )
}
