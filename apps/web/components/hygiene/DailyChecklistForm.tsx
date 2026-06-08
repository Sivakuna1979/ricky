'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { OPENING_CHECKLIST, CLOSING_CHECKLIST } from '@/lib/utils/checklists'

interface Props {
  businessId: string
  vanId?: string
  type: 'opening_checklist' | 'closing_checklist'
  onSuccess?: () => void
}

export function DailyChecklistForm({ businessId, vanId, type, onSuccess }: Props) {
  const items = type === 'opening_checklist' ? OPENING_CHECKLIST : CLOSING_CHECKLIST
  const [checked, setChecked] = useState<boolean[]>(items.map(() => false))
  const [signature, setSignature] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const toggle = (i: number) => setChecked(prev => prev.map((v, idx) => idx === i ? !v : v))
  const allChecked = checked.every(Boolean)
  const completedCount = checked.filter(Boolean).length

  const submit = async () => {
    if (!signature.trim()) { toast.error('Please enter your name as a digital signature'); return }
    setSubmitting(true)

    const res = await fetch('/api/hygiene/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: businessId,
        van_id: vanId,
        checklist_type: type,
        items: items.map((label, i) => ({ label, completed: checked[i] })),
        digital_signature: signature,
        notes,
      }),
    })

    if (res.ok) {
      toast.success('Checklist submitted successfully')
      setChecked(items.map(() => false))
      setSignature('')
      setNotes('')
      onSuccess?.()
    } else {
      toast.error('Failed to submit checklist')
    }
    setSubmitting(false)
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">
          {type === 'opening_checklist' ? '🌅 Opening Checklist' : '🌙 Closing Checklist'}
        </h3>
        <span className="text-sm text-gray-500">{completedCount}/{items.length}</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full mb-5">
        <div
          className="h-2 bg-brand-500 rounded-full transition-all"
          style={{ width: `${(completedCount / items.length) * 100}%` }}
        />
      </div>

      <div className="space-y-3 mb-5">
        {items.map((item, i) => (
          <label key={i} className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={() => toggle(i)}
              className="mt-0.5 h-5 w-5 rounded text-brand-500 focus:ring-brand-500"
            />
            <span className={`text-sm ${checked[i] ? 'line-through text-gray-400' : 'text-gray-700'}`}>
              {item}
            </span>
          </label>
        ))}
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none resize-none text-sm"
            placeholder="Any issues or notes..." />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Digital Signature (type your full name)</label>
          <input value={signature} onChange={e => setSignature(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none italic"
            placeholder="Your full name..." />
        </div>

        {!allChecked && (
          <p className="text-sm text-amber-600 bg-amber-50 rounded-lg p-3">
            ⚠ Not all items are checked. You can still submit but it will be marked as non-compliant.
          </p>
        )}

        <button onClick={submit} disabled={submitting || !signature.trim()}
          className="w-full bg-brand-500 text-white py-3 rounded-xl font-semibold hover:bg-brand-600 disabled:opacity-50">
          {submitting ? 'Submitting...' : 'Submit Checklist'}
        </button>
      </div>
    </div>
  )
}
