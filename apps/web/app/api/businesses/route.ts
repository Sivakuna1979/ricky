/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('businesses')
    .select('*, vans(id, name, tracking_status)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const admin = await createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get internal user
  const { data: userData } = await admin
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single() as { data: { id: string; role: string } | null }

  if (!userData) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Update user role to business_owner if needed
  if (userData.role === 'customer') {
    await admin.from('users').update({ role: 'business_owner' }).eq('id', userData.id)
  }

  const body = await req.json()
  const { name, slug, business_type, phone, postcode, city, email } = body

  // Check slug uniqueness
  const { data: existing } = await admin
    .from('businesses')
    .select('id')
    .eq('slug', slug)
    .single()

  const finalSlug = existing ? `${slug}-${Date.now()}` : slug

  const { data: business, error } = await admin
    .from('businesses')
    .insert({
      owner_id: userData.id,
      name,
      slug: finalSlug,
      business_type: business_type ?? 'other',
      phone,
      postcode,
      city,
      email,
      status: 'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Create default subscription (14-day trial)
  const { data: plan } = await admin
    .from('subscription_plans')
    .select('id')
    .eq('name', 'Starter')
    .single()

  if (plan) {
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 14)

    await admin.from('subscriptions').insert({
      business_id: business.id,
      plan_id: plan.id,
      status: 'trialing',
      trial_ends_at: trialEnd.toISOString(),
    })
  }

  return NextResponse.json(business, { status: 201 })
}
