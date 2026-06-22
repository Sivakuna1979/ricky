// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  return createServerClient(url, key, {
    cookies: { getAll: () => [], setAll: () => {} },
    auth: { persistSession: false },
  })
}

export async function POST(req: NextRequest) {
  try {
    const { items, vanId } = await req.json()
    if (!items?.length) return NextResponse.json({ error: 'No items provided' }, { status: 400 })

    const admin = getAdmin()

    // If vanId provided, insert directly
    if (vanId) {
      const rows = items.map((item: any) => ({
        van_id:      vanId,
        name:        item.name,
        description: item.description ?? '',
        price:       parseFloat(item.price) || 0,
        category:    item.category ?? 'Mains',
        available:   true,
      }))
      const { error } = await admin.from('menu_items').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ inserted: rows.length })
    }

    return NextResponse.json({ error: 'vanId required' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Import failed' }, { status: 500 })
  }
}
