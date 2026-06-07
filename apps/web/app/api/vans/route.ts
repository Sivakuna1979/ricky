import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/vans?postcode=M1 1AA&type=fish_and_chips&radius=10
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const search = searchParams.get('search')

  let query = supabase
    .from('vans')
    .select(`
      *,
      businesses!inner(id, name, slug, status, postcode, city, county, food_hygiene_rating),
      menus(id, is_active),
      reviews(rating)
    `)
    .eq('is_active', true)
    .eq('businesses.status', 'approved')

  if (type) query = query.eq('van_type', type)
  if (search) {
    query = query.or(`name.ilike.%${search}%,businesses.city.ilike.%${search}%,businesses.postcode.ilike.%${search}%`)
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { business_id, name, van_type, description, registration_plate } = body

  // Verify ownership
  const { data: business } = await supabase
    .from('businesses')
    .select('id, owner_id')
    .eq('id', business_id)
    .single()

  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  if (!business || business.owner_id !== userData?.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Check subscription van limit
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*, subscription_plans(max_vans)')
    .eq('business_id', business_id)
    .in('status', ['trialing', 'active'])
    .single()

  const { count: vanCount } = await supabase
    .from('vans')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', business_id)

  const maxVans = (subscription as any)?.subscription_plans?.max_vans ?? 1
  if ((vanCount ?? 0) >= maxVans) {
    return NextResponse.json({ error: `Your plan allows a maximum of ${maxVans} van(s). Please upgrade.` }, { status: 403 })
  }

  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`

  const { data: van, error } = await supabase
    .from('vans')
    .insert({ business_id, name, slug, van_type: van_type ?? 'other', description, registration_plate })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-create default menu
  await supabase.from('menus').insert({ van_id: van.id, name: 'Main Menu', is_active: true })

  // Auto-generate QR code
  await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/vans/${van.id}/qr-code/generate`, {
    method: 'POST',
    headers: { Cookie: req.headers.get('cookie') ?? '' },
  })

  return NextResponse.json(van, { status: 201 })
}
