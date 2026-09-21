// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireCustomer } from '@/lib/customer/identity'

// J13 — reuses customer_favourite_vans exactly as originally designed.
export async function GET() {
  const supabase = await createClient()
  const admin = await createAdminClient()
  const ctx = await requireCustomer(supabase, admin)
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data, error } = await admin
    .from('customer_favourite_vans')
    .select('van_id, created_at, vans(id, name, slug, tracking_status, profile_image_url, businesses(name, city))')
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

  const { van_id } = await req.json().catch(() => ({}))
  if (!van_id) return NextResponse.json({ error: 'van_id required' }, { status: 400 })

  // J13 — favouriting a van must never itself subscribe to marketing.
  const { error } = await admin.from('customer_favourite_vans').upsert(
    { customer_id: ctx.customer.id, van_id },
    { onConflict: 'customer_id,van_id' }
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
  const van_id = searchParams.get('van_id')
  if (!van_id) return NextResponse.json({ error: 'van_id required' }, { status: 400 })

  const { error } = await admin.from('customer_favourite_vans').delete().eq('customer_id', ctx.customer.id).eq('van_id', van_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
