'use client'

import { useState } from 'react'
import type { Agent } from '@/lib/types'

const ALL_TOOLS = [
  { id: 'web_search', label: 'Web search' },
  { id: 'image_generation', label: 'Image generation' },
  { id: 'knowledge_base', label: 'Knowledge base' },
  { id: 'reminders', label: 'Scheduled reminders & jobs' },
  { id: 'google_workspace', label: 'Google Workspace' },
]

export default function AgentEditor({ agent }: { agent: Agent }) {
  const [name, setName] = useState(agent.name)
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt)
  const [temperature, setTemperature] = useState(agent.temperature)
  const [voice, setVoice] = useState(agent.voice_enabled)
  const [tools, setTools] = useState<string[]>(agent.tools_enabled ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function toggleTool(id: string) {
    setTools((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]))
  }

  async function save() {
    setSaving(true)
    setSaved(false)
    const res = await fetch(`/api/agents/${agent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        system_prompt: systemPrompt,
        temperature: Number(temperature),
        voice_enabled: voice,
        tools_enabled: tools,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  return (
    <div className="card space-y-4">
      <div>
        <label className="label">Agent name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="label">System prompt (persona & instructions)</label>
        <textarea
          className="input min-h-[140px]"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-6">
        <div>
          <label className="label">Temperature: {Number(temperature).toFixed(1)}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} />
          Voice conversations
        </label>
      </div>
      <div>
        <label className="label">Enabled tools</label>
        <div className="grid grid-cols-2 gap-2">
          {ALL_TOOLS.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={tools.includes(t.id)} onChange={() => toggleTool(t.id)} />
              {t.label}
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save agent'}
        </button>
        {saved && <span className="text-sm text-green-700">Saved ✓</span>}
      </div>
    </div>
  )
}
