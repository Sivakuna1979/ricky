'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  channelId: string
  niches: Array<{ id: string; name: string }>
  settings: {
    niche_id: string | null
    upload_pattern: string
    approval_mode: string
    production_mode: string
    slot_time_1: string
    slot_time_2: string
  }
  isPaused: boolean
}

export function ChannelSettingsForm({ channelId, niches, settings, isPaused }: Props) {
  const router = useRouter()
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await fetch(`/api/channels/${channelId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    router.refresh()
  }

  async function togglePause() {
    await fetch(`/api/channels/${channelId}/pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused: !isPaused }),
    })
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Niche</label>
        <select className="input" value={form.niche_id ?? ''} onChange={(e) => setForm({ ...form, niche_id: e.target.value || null })}>
          <option value="">— none selected —</option>
          {niches.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Daily upload pattern</label>
        <select className="input" value={form.upload_pattern} onChange={(e) => setForm({ ...form, upload_pattern: e.target.value })}>
          <option value="two_shorts">Two Shorts</option>
          <option value="short_and_long">One Short + one long video</option>
          <option value="two_long">Two long videos</option>
          <option value="custom">Custom weekly schedule (edit via API)</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Slot 1 time</label>
          <input type="time" className="input" value={form.slot_time_1} onChange={(e) => setForm({ ...form, slot_time_1: e.target.value })} />
        </div>
        <div>
          <label className="label">Slot 2 time</label>
          <input type="time" className="input" value={form.slot_time_2} onChange={(e) => setForm({ ...form, slot_time_2: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="label">Approval mode</label>
        <select className="input" value={form.approval_mode} onChange={(e) => setForm({ ...form, approval_mode: e.target.value })}>
          <option value="manual">Manual approval — approve topic, script, video and thumbnail</option>
          <option value="assisted">Assisted automation — review final video before upload</option>
          <option value="full_auto">Full automation — publishes automatically when checks pass</option>
        </select>
      </div>
      <div>
        <label className="label">Production mode</label>
        <select className="input" value={form.production_mode} onChange={(e) => setForm({ ...form, production_mode: e.target.value })}>
          <option value="low_cost">Low cost</option>
          <option value="standard">Standard</option>
          <option value="premium">Premium</option>
        </select>
      </div>
      <div className="flex gap-2 pt-2">
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button>
        <button className={isPaused ? 'btn-primary' : 'btn-danger'} onClick={togglePause}>
          {isPaused ? 'Resume this channel' : 'Pause this channel'}
        </button>
      </div>
    </div>
  )
}
