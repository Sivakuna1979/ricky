'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Menu, MenuCategory, MenuItem } from '@/types/database'
import { toast } from 'sonner'
import { MenuItemForm } from './MenuItemForm'
import { formatCurrency } from '@/lib/utils/format'

interface Props {
  vanId: string
}

export function MenuBuilder({ vanId }: Props) {
  const [menu, setMenu] = useState<Menu | null>(null)
  const [categories, setCategories] = useState<(MenuCategory & { items: MenuItem[] })[]>([])
  const [newCatName, setNewCatName] = useState('')
  const [editingItem, setEditingItem] = useState<{ categoryId: string; item?: MenuItem } | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const load = async () => {
    setLoading(true)
    const { data: menuData } = await supabase.from('menus').select('*').eq('van_id', vanId).eq('is_active', true).single()
    if (!menuData) { setLoading(false); return }
    setMenu(menuData)

    const { data: cats } = await supabase
      .from('menu_categories')
      .select('*, menu_items(*, menu_item_options(*, menu_item_option_choices(*)))')
      .eq('menu_id', menuData.id)
      .eq('is_active', true)
      .order('sort_order')

    setCategories((cats as any) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [vanId])

  const addCategory = async () => {
    if (!newCatName.trim() || !menu) return
    const { data, error } = await supabase
      .from('menu_categories')
      .insert({ menu_id: menu.id, name: newCatName.trim(), sort_order: categories.length })
      .select()
      .single()

    if (error) { toast.error('Failed to add category'); return }
    setCategories(prev => [...prev, { ...data, items: [] }])
    setNewCatName('')
    toast.success('Category added')
  }

  const deleteCategory = async (catId: string) => {
    if (!confirm('Delete this category and all its items?')) return
    await supabase.from('menu_categories').update({ is_active: false }).eq('id', catId)
    setCategories(prev => prev.filter(c => c.id !== catId))
    toast.success('Category removed')
  }

  const toggleItem = async (itemId: string, current: boolean) => {
    await supabase.from('menu_items').update({ is_available: !current }).eq('id', itemId)
    setCategories(prev => prev.map(c => ({
      ...c,
      items: c.items.map(i => i.id === itemId ? { ...i, is_available: !current } : i),
    })))
  }

  const deleteItem = async (catId: string, itemId: string) => {
    if (!confirm('Delete this item?')) return
    await supabase.from('menu_items').delete().eq('id', itemId)
    setCategories(prev => prev.map(c =>
      c.id === catId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c
    ))
    toast.success('Item deleted')
  }

  if (loading) return <div className="animate-pulse h-64 bg-gray-100 rounded-2xl" />

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <input
          value={newCatName}
          onChange={e => setNewCatName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addCategory()}
          placeholder="New category name (e.g. Mains, Drinks)..."
          className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none"
        />
        <button onClick={addCategory} className="px-5 py-3 bg-brand-500 text-white rounded-xl font-semibold hover:bg-brand-600">
          + Category
        </button>
      </div>

      {categories.map(cat => (
        <div key={cat.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">{cat.name}</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setEditingItem({ categoryId: cat.id })}
                className="px-3 py-1.5 bg-brand-50 text-brand-600 rounded-lg text-sm font-medium hover:bg-brand-100"
              >
                + Add Item
              </button>
              <button
                onClick={() => deleteCategory(cat.id)}
                className="px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg text-sm"
              >
                Delete
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-100">
            {cat.items.map(item => (
              <div key={item.id} className="flex items-center gap-4 px-5 py-3">
                {item.image_url && (
                  <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-lg object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{item.name}</p>
                  {item.description && <p className="text-sm text-gray-500 truncate">{item.description}</p>}
                </div>
                <span className="font-semibold text-gray-900">{formatCurrency(item.price)}</span>
                <button
                  onClick={() => toggleItem(item.id, item.is_available)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium ${
                    item.is_available ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}
                >
                  {item.is_available ? 'Available' : 'Unavailable'}
                </button>
                <button onClick={() => setEditingItem({ categoryId: cat.id, item })} className="text-gray-400 hover:text-gray-600 text-sm">Edit</button>
                <button onClick={() => deleteItem(cat.id, item.id)} className="text-red-400 hover:text-red-600 text-sm">×</button>
              </div>
            ))}

            {cat.items.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-6">No items yet. Click &ldquo;+ Add Item&rdquo; to add your first item.</p>
            )}
          </div>
        </div>
      ))}

      {editingItem && (
        <MenuItemForm
          categoryId={editingItem.categoryId}
          item={editingItem.item}
          onClose={() => setEditingItem(null)}
          onSave={() => { setEditingItem(null); load() }}
        />
      )}
    </div>
  )
}
