// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2024-06-20' })
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://food-taxi.vercel.app'

// Creates a Stripe Checkout link for an event application's booking fee.
// POST { application_id } -> { url }
export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Payments not configured yet — add STRIPE_SECRET_KEY in Vercel.' }, { status: 503 })
    }
    const { application_id } = await req.json()
    if (!application_id) return NextResponse.json({ error: 'application_id required' }, { status: 400 })

    const admin = await createAdminClient()
    const { data: app } = await admin
      .from('event_applications')
      .select('id, event_id, van_owner_email, business_name, status, paid_at')
      .eq('id', application_id)
      .single()
    if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    if (app.paid_at) return NextResponse.json({ error: 'This booking fee is already paid.' }, { status: 409 })

    const { data: evt } = await admin
      .from('event_requests')
      .select('id, event_date, event_location, event_type, foodtaxi_fee')
      .eq('id', app.event_id)
      .single()
    const fee = Number(evt?.foodtaxi_fee ?? 29.99)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: app.van_owner_email ?? undefined,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'gbp',
          unit_amount: Math.round(fee * 100),
          product_data: {
            name: `FoodTaxi event booking fee — ${evt?.event_location ?? 'event'} (${evt?.event_date ?? ''})`,
            description: `Flat booking fee for your confirmed pitch. Business: ${app.business_name ?? ''}`,
          },
        },
      }],
      metadata: { application_id: app.id, event_id: app.event_id, kind: 'event_booking_fee' },
      success_url: `${APP_URL}/van/events?paid=1`,
      cancel_url: `${APP_URL}/van/events?paid=0`,
    })

    await admin.from('event_applications').update({ stripe_session_id: session.id, fee }).eq('id', app.id)
    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Could not create payment link' }, { status: 500 })
  }
}
