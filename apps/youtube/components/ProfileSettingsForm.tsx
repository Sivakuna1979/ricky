'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  userId: string
  initial: { notification_email: string | null; daily_spend_limit_usd: number; monthly_spend_limit_usd: number }
}

export function ProfileSettingsForm({ userId, initial }: Props) {
  const router = useRouter()
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const supabase = createClient()
    await supabase
      .from('yt_profiles')
      .update({
        notification_email: form.notification_email,
        daily_spend_limit_usd: form.daily_spend_limit_usd,
        monthly_spend_limit_usd: form.monthly_spend_limit_usd,
      })
      .eq('id', userId)
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Notification email</label>
        <input className="input" type="email" value={form.notification_email ?? ''} onChange={(e) => setForm({ ...form, notification_email: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Daily spend limit (USD)</label>
          <input className="input" type="number" min={0} step={0.5} value={form.daily_spend_limit_usd} onChange={(e) => setForm({ ...form, daily_spend_limit_usd: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label">Monthly spend limit (USD)</label>
          <input className="input" type="number" min={0} step={1} value={form.monthly_spend_limit_usd} onChange={(e) => setForm({ ...form, monthly_spend_limit_usd: Number(e.target.value) })} />
        </div>
      </div>
      <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
    </div>
  )
}
