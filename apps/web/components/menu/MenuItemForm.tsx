'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { MenuItem } from '@/types/database'

const ALLERGENS = ['Celery', 'Gluten', 'Crustaceans', 'Eggs', 'Fish', 'Lupin', 'Milk', 'Molluscs', 'Mustard', 'Tree nuts', 'Peanuts', 'Sesame seeds', 'Soybeans', 'Sulphur dioxide']

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Price must be 0 or more'),
  calories: z.coerce.number().optional(),
  is_available: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  allergens: z.array(z.string()).default([]),
})

type FormData = z.infer<typeof schema>

interface Props {
  categoryId: string
  item?: MenuItem
  onClose: () => void
  onSave: () => void
}

export function MenuItemForm({ categoryId, item, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: item?.name ?? '',
      description: item?.description ?? '',
      price: item?.price ?? 0,
      calories: item?.calories ?? undefined,
      is_available: item?.is_available ?? true,
      is_featured: item?.is_featured ?? false,
      allergens: item?.allergens ?? [],
    },
  })

  const selectedAllergens = watch('allergens') ?? []

  const toggleAllergen = (allergen: string) => {
    const current = selectedAllergens
    if (current.includes(allergen)) {
      setValue('allergens', current.filter(a => a !== allergen))
    } else {
      setValue('allergens', [...current, allergen])
    }
  }

  const onSubmit = async (data: FormData) => {
    setSaving(true)
    if (item) {
      const { error } = await supabase.from('menu_items').update(data).eq('id', item.id)
      if (error) { toast.error(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('menu_items').insert({ ...data, category_id: categoryId })
      if (error) { toast.error(error.message); setSaving(false); return }
    }
    toast.success(`Item ${item ? 'updated' : 'added'}`)
    onSave()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">{item ? 'Edit Item' : 'Add Menu Item'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
            <input {...register('name')} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" placeholder="e.g. Large Cod & Chips" />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...register('description')} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none resize-none" placeholder="Describe the item..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (£) *</label>
              <input {...register('price')} type="number" step="0.01" min="0" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" placeholder="0.00" />
              {errors.price && <p className="text-sm text-red-500 mt-1">{errors.price.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Calories (optional)</label>
              <input {...register('calories')} type="number" min="0" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" placeholder="e.g. 850" />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input {...register('is_available')} type="checkbox" className="h-4 w-4 text-brand-500" />
              <span className="text-sm text-gray-700">Available</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input {...register('is_featured')} type="checkbox" className="h-4 w-4 text-brand-500" />
              <span className="text-sm text-gray-700">Featured</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Allergens</label>
            <div className="flex flex-wrap gap-2">
              {ALLERGENS.map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAllergen(a)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedAllergens.includes(a)
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-3 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600 disabled:opacity-50">
              {saving ? 'Saving...' : item ? 'Update Item' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
