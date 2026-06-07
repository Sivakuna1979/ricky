'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

const LOG_TYPES = [
  { value: 'fridge_temp', label: 'Fridge Temperature', min: 0, max: 8, unit: '°C', warn: 'Must be 0–8°C' },
  { value: 'freezer_temp', label: 'Freezer Temperature', min: -25, max: -18, unit: '°C', warn: 'Must be -18°C or below' },
  { value: 'hot_holding_temp', label: 'Hot Holding Temperature', min: 63, max: 100, unit: '°C', warn: 'Must be 63°C or above' },
  { value: 'cooking_temp', label: 'Cooking Temperature', min: 75, max: 100, unit: '°C', warn: 'Must reach 75°C' },
]

const schema = z.object({
  log_type: z.enum(['fridge_temp', 'freezer_temp', 'hot_holding_temp', 'cooking_temp']),
  equipment_name: z.string().optional(),
  temperature_celsius: z.coerce.number(),
  corrective_action: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  businessId: string
  vanId?: string
  onSuccess?: () => void
}

export function TemperatureLogForm({ businessId, vanId, onSuccess }: Props) {
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ compliant: boolean; temp: number } | null>(null)

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { log_type: 'fridge_temp' },
  })

  const logType = watch('log_type')
  const selectedType = LOG_TYPES.find(t => t.value === logType)

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    const res = await fetch('/api/hygiene/temperature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, business_id: businessId, van_id: vanId }),
    })

    if (res.ok) {
      const saved = await res.json()
      setResult({ compliant: saved.is_within_range, temp: data.temperature_celsius })
      toast.success('Temperature logged successfully')
      reset()
      onSuccess?.()
    } else {
      toast.error('Failed to log temperature')
    }
    setSubmitting(false)
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 className="font-semibold text-gray-900 mb-4">Log Temperature</h3>

      {result && (
        <div className={`mb-4 p-3 rounded-xl text-sm ${result.compliant ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {result.compliant
            ? `✓ ${result.temp}°C — Within safe range`
            : `⚠ ${result.temp}°C — OUTSIDE safe range. Corrective action required.`}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Log Type</label>
          <select {...register('log_type')} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none">
            {LOG_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {selectedType && (
            <p className="text-xs text-gray-500 mt-1">Safe range: {selectedType.warn}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Equipment Name (optional)</label>
          <input {...register('equipment_name')} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" placeholder="e.g. Main Fridge, Chest Freezer" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (°C)</label>
          <input
            {...register('temperature_celsius')}
            type="number"
            step="0.1"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-lg font-bold"
            placeholder="0.0"
          />
          {errors.temperature_celsius && <p className="text-sm text-red-500 mt-1">{errors.temperature_celsius.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Corrective Action (if out of range)</label>
          <textarea {...register('corrective_action')} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none resize-none" placeholder="Describe action taken..." />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-500 text-white py-3 rounded-xl font-semibold hover:bg-brand-600 disabled:opacity-50"
        >
          {submitting ? 'Logging...' : 'Log Temperature'}
        </button>
      </form>
    </div>
  )
}
