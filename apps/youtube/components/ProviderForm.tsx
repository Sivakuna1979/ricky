'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PROVIDER_OPTIONS: Array<{ type: string; name: string; label: string; needsBaseUrl?: boolean; needsModel?: boolean; helpUrl: string }> = [
  { type: 'script_ai', name: 'openai', label: 'Script / research AI (OpenAI-compatible)', needsBaseUrl: true, needsModel: true, helpUrl: 'https://platform.openai.com/api-keys' },
  { type: 'research', name: 'serper', label: 'Web research (Serper.dev)', helpUrl: 'https://serper.dev' },
  { type: 'tts', name: 'elevenlabs', label: 'Text-to-speech (ElevenLabs)', helpUrl: 'https://elevenlabs.io' },
  { type: 'tts', name: 'openai', label: 'Text-to-speech fallback (OpenAI)', needsModel: true, helpUrl: 'https://platform.openai.com/api-keys' },
  { type: 'image_gen', name: 'openai', label: 'Image generation (OpenAI Images)', needsModel: true, helpUrl: 'https://platform.openai.com/api-keys' },
  { type: 'stock_video', name: 'pexels', label: 'Stock video & photo (Pexels)', helpUrl: 'https://www.pexels.com/api/' },
]

export function ProviderForm({ configured }: { configured: Array<{ provider_type: string; provider_name: string }> }) {
  const router = useRouter()
  const [selected, setSelected] = useState(PROVIDER_OPTIONS[0])
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [saving, setSaving] = useState(false)

  const isConfigured = (type: string, name: string) => configured.some((c) => c.provider_type === type && c.provider_name === name)

  async function save() {
    setSaving(true)
    await fetch('/api/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerType: selected.type,
        providerName: selected.name,
        apiKey,
        ...(baseUrl ? { baseUrl } : {}),
        ...(model ? { model } : {}),
      }),
    })
    setSaving(false)
    setApiKey('')
    router.refresh()
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">Add / update a provider key</h2>
      <div>
        <label className="label">Provider</label>
        <select
          className="input"
          value={`${selected.type}:${selected.name}`}
          onChange={(e) => {
            const opt = PROVIDER_OPTIONS.find((o) => `${o.type}:${o.name}` === e.target.value)!
            setSelected(opt)
          }}
        >
          {PROVIDER_OPTIONS.map((o) => (
            <option key={`${o.type}:${o.name}`} value={`${o.type}:${o.name}`}>
              {o.label} {isConfigured(o.type, o.name) ? '(configured)' : ''}
            </option>
          ))}
        </select>
        <a href={selected.helpUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-brand underline">
          Where do I get this key?
        </a>
      </div>
      <div>
        <label className="label">API key</label>
        <input className="input" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." />
      </div>
      {selected.needsBaseUrl && (
        <div>
          <label className="label">Base URL (optional — defaults to api.openai.com)</label>
          <input className="input" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" />
        </div>
      )}
      {selected.needsModel && (
        <div>
          <label className="label">Model (optional)</label>
          <input className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. gpt-4.1-mini" />
        </div>
      )}
      <button className="btn-primary" onClick={save} disabled={saving || !apiKey}>{saving ? 'Saving…' : 'Save key'}</button>
      <p className="text-xs text-neutral-500">Keys are encrypted (AES-256-GCM) before they touch the database and are never sent back to the browser.</p>
    </div>
  )
}
