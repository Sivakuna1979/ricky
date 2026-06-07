'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import type { RouteStop } from '@/types/database'

const schema = z.object({
  name: z.string().min(1, 'Stop name is required'),
  postcode: z.string().min(5, 'Enter a valid postcode'),
  address: z.string().optional(),
  arrival_time: z.string().min(1, 'Arrival time is required'),
  leaving_time: z.string().min(1, 'Leaving time is required'),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  routeId: string
  nextOrder: number
  onClose: () => void
  onSave: (stop: RouteStop) => void
}

export function StopForm({ routeId, nextOrder, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const supabase = createClient()

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const geocodePostcode = async () => {
    const postcode = watch('postcode')
    if (!postcode || postcode.length < 5) return
    setGeocoding(true)
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`)
      const data = await res.json()
      if (data.result) {
        setValue('address', `${postcode.toUpperCase()}`)
      }
    } finally {
      setGeocoding(false)
    }
  }

  const onSubmit = async (data: FormData) => {
    setSaving(true)

    // Geocode postcode for lat/lng
    let latitude: number | null = null
    let longitude: number | null = null
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(data.postcode)}`)
      const geo = await res.json()
      if (geo.result) { latitude = geo.result.latitude; longitude = geo.result.longitude }
    } catch {}

    const { data: stop, error } = await supabase
      .from('route_stops')
      .insert({
        route_id: routeId,
        name: data.name,
        postcode: data.postcode.toUpperCase(),
        address: data.address,
        arrival_time: data.arrival_time,
        leaving_time: data.leaving_time,
        notes: data.notes,
        stop_order: nextOrder,
        latitude,
        longitude,
        is_active: true,
      })
      .select()
      .single()

    if (error) { setSaving(false); return }
    onSave(stop)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Add Stop</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stop Name *</label>
            <input {...register('name')} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" placeholder="e.g. High Street Bus Stop" />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Postcode *</label>
            <div className="flex gap-2">
              <input {...register('postcode')} className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" placeholder="M1 1AA" />
              <button type="button" onClick={geocodePostcode} disabled={geocoding}
                className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl text-sm hover:bg-gray-200">
                {geocoding ? '...' : 'Lookup'}
              </button>
            </div>
            {errors.postcode && <p className="text-sm text-red-500 mt-1">{errors.postcode.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address (optional)</label>
            <input {...register('address')} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Street address or landmark" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Time *</label>
              <input {...register('arrival_time')} type="time" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" />
              {errors.arrival_time && <p className="text-sm text-red-500 mt-1">{errors.arrival_time.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Leaving Time *</label>
              <input {...register('leaving_time')} type="time" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" />
              {errors.leaving_time && <p className="text-sm text-red-500 mt-1">{errors.leaving_time.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input {...register('notes')} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" placeholder="e.g. Opposite the library" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-3 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 disabled:opacity-50">
              {saving ? 'Adding...' : 'Add Stop'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
