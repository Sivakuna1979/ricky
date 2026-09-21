// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireCustomer } from '@/lib/customer/identity'

// J14 — favourite menu items. If an item is later removed, this row is
// cascade-deleted (menu_item_id ON DELETE CASCADE) — history is not
// "preserved" by keeping a dangling favourite that could be re-added to a
// cart; that would risk letting a removed item be ordered again.
export async function GET() {
  const supabase = await createClient()
  const admin = await createAdminClient()
  const ctx = await requireCustomer(supabase, admin)
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data, error } = await admin
    .from('customer_favourite_items')
    .select('menu_item_id, created_at, menu_items(id, name, price, available, van_id, vans(name, slug))')
    .eq('customer_id', ctx.customer.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ favourites: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const admin = await createAdminClient()
  const ctx = await requireCustomer(supabase, admin)
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { menu_item_id } = await req.json().catch(() => ({}))
  if (!menu_item_id) return NextResponse.json({ error: 'menu_item_id required' }, { status: 400 })

  const { error } = await admin.from('customer_favourite_items').upsert(
    { customer_id: ctx.customer.id, menu_item_id },
    { onConflict: 'customer_id,menu_item_id' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const admin = await createAdminClient()
  const ctx = await requireCustomer(supabase, admin)
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const menu_item_id = searchParams.get('menu_item_id')
  if (!menu_item_id) return NextResponse.json({ error: 'menu_item_id required' }, { status: 400 })

  const { error } = await admin.from('customer_favourite_items').delete().eq('customer_id', ctx.customer.id).eq('menu_item_id', menu_item_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
